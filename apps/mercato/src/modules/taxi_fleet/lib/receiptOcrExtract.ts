import { generateText, type LanguageModel } from 'ai'
import { z } from 'zod'
import fs from 'fs/promises'
import path from 'path'

const receiptOcrFieldsSchema = z.object({
  documentNumber: z.string().nullable().optional(),
  grossAmount: z.number().nullable().optional(),
  distanceKm: z.number().nullable().optional(),
  vatRatePercent: z.number().nullable().optional(),
  buyerNip: z.string().nullable().optional(),
  sellerNip: z.string().nullable().optional(),
  occurredAt: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  rawExcerpt: z.string().nullable().optional(),
})

export type ReceiptOcrFields = z.infer<typeof receiptOcrFieldsSchema>
export type ReceiptOcrProviderId = 'openai' | 'anthropic'

const PROMPT = `You extract fields from a Polish fiscal receipt (paragon fiskalny) or invoice photo/PDF.
Return ONLY valid JSON with keys:
documentNumber (string|null) — receipt/invoice number,
grossAmount (number|null) — total gross amount PLN,
distanceKm (number|null) — trip distance in kilometers if printed on the receipt (look for "Dystans", "km", "kilometry", "przebieg"),
vatRatePercent (number|null) — VAT rate percent as shown on the document (typically 8 or 23 in Poland),
buyerNip (string|null) — buyer NIP digits only if present,
sellerNip (string|null) — seller NIP digits only if present,
occurredAt (ISO date or datetime string|null) — document issue date (prefer full ISO if time is readable),
confidence (0..1),
rawExcerpt (short string of key lines).
If a field is unreadable, use null.`

const DEFAULT_MODELS: Record<ReceiptOcrProviderId, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
}

function normalizeEnv(value: string | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  if (
    lower.startsWith('your_') ||
    lower.includes('your_') ||
    lower.includes('changeme') ||
    lower.includes('replace_me') ||
    lower === 'xxx' ||
    lower === 'todo'
  ) {
    return null
  }
  return trimmed
}

function isPdfMimeType(mimeType: string | null, filePath: string): boolean {
  const normalized = (mimeType || '').toLowerCase()
  if (normalized === 'application/pdf') return true
  return path.extname(filePath).toLowerCase() === '.pdf'
}

function getImageMediaType(mimeType: string | null, filePath: string): string {
  if (mimeType && mimeType.startsWith('image/')) return mimeType
  const ext = path.extname(filePath).toLowerCase()
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  }
  return map[ext] || 'image/jpeg'
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1]?.trim() ?? trimmed
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('OCR response did not contain JSON object')
  return JSON.parse(candidate.slice(start, end + 1)) as unknown
}

function stripProviderPrefix(modelToken: string): string {
  const slash = modelToken.indexOf('/')
  if (slash <= 0) return modelToken
  return modelToken.slice(slash + 1).trim() || modelToken
}

function inferProviderFromModel(modelToken: string | null): ReceiptOcrProviderId | null {
  if (!modelToken) return null
  const lower = modelToken.toLowerCase()
  if (lower.startsWith('anthropic/') || lower.includes('claude')) return 'anthropic'
  if (lower.startsWith('openai/') || lower.includes('gpt') || lower.includes('o1') || lower.includes('o3')) {
    return 'openai'
  }
  return null
}

export function hasOpenAiReceiptOcrKey(): boolean {
  return Boolean(normalizeEnv(process.env.OPENAI_API_KEY))
}

export function hasAnthropicReceiptOcrKey(): boolean {
  return Boolean(normalizeEnv(process.env.ANTHROPIC_API_KEY))
}

/**
 * Pick OCR provider from env keys only:
 * - only OPENAI_API_KEY → openai
 * - only ANTHROPIC_API_KEY → anthropic
 * - both → prefer provider matching OCR_MODEL, else openai
 * - TAXI_FLEET_RECEIPT_OCR_PROVIDER overrides when that key is present
 */
export function resolveReceiptOcrProvider(): ReceiptOcrProviderId | null {
  const hasOpenAi = hasOpenAiReceiptOcrKey()
  const hasAnthropic = hasAnthropicReceiptOcrKey()
  if (!hasOpenAi && !hasAnthropic) return null

  const explicit = normalizeEnv(process.env.TAXI_FLEET_RECEIPT_OCR_PROVIDER)?.toLowerCase()
  if (explicit === 'openai' && hasOpenAi) return 'openai'
  if (explicit === 'anthropic' && hasAnthropic) return 'anthropic'

  if (hasOpenAi && !hasAnthropic) return 'openai'
  if (hasAnthropic && !hasOpenAi) return 'anthropic'

  const fromModel = inferProviderFromModel(normalizeEnv(process.env.OCR_MODEL))
  if (fromModel === 'anthropic') return 'anthropic'
  return 'openai'
}

/** Ordered providers to try (primary + failover when both keys exist). */
export function resolveReceiptOcrProviderChain(): ReceiptOcrProviderId[] {
  const primary = resolveReceiptOcrProvider()
  if (!primary) return []
  const chain: ReceiptOcrProviderId[] = [primary]
  const other: ReceiptOcrProviderId = primary === 'openai' ? 'anthropic' : 'openai'
  if (other === 'openai' && hasOpenAiReceiptOcrKey()) chain.push(other)
  if (other === 'anthropic' && hasAnthropicReceiptOcrKey()) chain.push(other)
  return chain
}

export function resolveReceiptOcrModel(provider: ReceiptOcrProviderId): string {
  const raw = normalizeEnv(process.env.OCR_MODEL)
  if (!raw) return DEFAULT_MODELS[provider]
  const modelId = stripProviderPrefix(raw)
  const inferred = inferProviderFromModel(raw)
  if (inferred && inferred !== provider) return DEFAULT_MODELS[provider]
  return modelId
}

export function isTaxiFleetReceiptOcrEnabled(): boolean {
  if (process.env.TAXI_FLEET_RECEIPT_OCR_ENABLED === '0') return false
  if (process.env.TAXI_FLEET_RECEIPT_OCR_ENABLED === 'false') return false
  return resolveReceiptOcrProvider() != null
}

async function createReceiptOcrModel(
  provider: ReceiptOcrProviderId,
  modelId: string,
): Promise<LanguageModel> {
  if (provider === 'anthropic') {
    const apiKey = normalizeEnv(process.env.ANTHROPIC_API_KEY)
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured')
    const { createAnthropic } = await import('@ai-sdk/anthropic')
    return createAnthropic({ apiKey })(modelId)
  }
  const apiKey = normalizeEnv(process.env.OPENAI_API_KEY)
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
  const { createOpenAI } = await import('@ai-sdk/openai')
  return createOpenAI({ apiKey })(modelId)
}

async function runReceiptOcrWithProvider(params: {
  provider: ReceiptOcrProviderId
  model?: string
  filePath: string
  mimeType: string | null
  fileBuffer: Buffer
  fileName: string
}): Promise<{ fields: ReceiptOcrFields; model: string; provider: ReceiptOcrProviderId }> {
  const model = params.model?.trim() || resolveReceiptOcrModel(params.provider)
  const languageModel = await createReceiptOcrModel(params.provider, model)
  const base64 = params.fileBuffer.toString('base64')

  const result = await generateText({
    model: languageModel,
    messages: [
      {
        role: 'user',
        content: isPdfMimeType(params.mimeType, params.filePath)
          ? [
              {
                type: 'file',
                data: `data:application/pdf;base64,${base64}`,
                mediaType: 'application/pdf',
                filename: params.fileName,
              },
              { type: 'text', text: PROMPT },
            ]
          : [
              {
                type: 'image',
                image: `data:${getImageMediaType(params.mimeType, params.filePath)};base64,${base64}`,
              },
              { type: 'text', text: PROMPT },
            ],
      },
    ],
  })

  const parsed = receiptOcrFieldsSchema.parse(extractJsonObject(result.text))
  return { fields: parsed, model, provider: params.provider }
}

export async function extractReceiptFieldsFromImage(params: {
  filePath: string
  mimeType: string | null
  model?: string
}): Promise<{ fields: ReceiptOcrFields; model: string; provider: ReceiptOcrProviderId }> {
  const chain = resolveReceiptOcrProviderChain()
  if (chain.length === 0) {
    throw new Error('Receipt OCR requires OPENAI_API_KEY or ANTHROPIC_API_KEY')
  }

  const fileBuffer = await fs.readFile(params.filePath)
  const fileName = path.basename(params.filePath) || 'receipt.pdf'
  let lastError: unknown = null

  for (let index = 0; index < chain.length; index += 1) {
    const provider = chain[index]!
    try {
      if (index > 0) {
        console.warn('[taxi_fleet.receipt_ocr] failing over to provider', {
          provider,
          previousError: lastError instanceof Error ? lastError.message : String(lastError),
        })
      }
      return await runReceiptOcrWithProvider({
        provider,
        model: params.model,
        filePath: params.filePath,
        mimeType: params.mimeType,
        fileBuffer,
        fileName,
      })
    } catch (error) {
      lastError = error
      console.error('[taxi_fleet.receipt_ocr] provider failed', {
        provider,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? 'Receipt OCR failed'))
}
