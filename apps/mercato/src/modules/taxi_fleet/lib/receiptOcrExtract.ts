import { generateText, type LanguageModel } from 'ai'
import { z } from 'zod'
import fs from 'fs/promises'
import path from 'path'
import { sanitizeReceiptOcrFields, type ReceiptOcrSanitizeMode } from './receiptOcrSanitize'

const receiptOcrFieldsSchema = z.object({
  documentNumber: z.string().nullable().optional(),
  grossAmount: z.number().nullable().optional(),
  distanceKm: z.number().nullable().optional(),
  vatRatePercent: z.number().nullable().optional(),
  vatAmount: z.number().nullable().optional(),
  buyerNip: z.string().nullable().optional(),
  sellerNip: z.string().nullable().optional(),
  registrationPlate: z.string().nullable().optional(),
  occurredAt: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  rawExcerpt: z.string().nullable().optional(),
  documentKind: z
    .enum([
      'fiscal_receipt',
      'invoice',
      'polcard_payment_confirmation',
      'payment_confirmation',
      'wz_slip',
      'unknown',
    ])
    .nullable()
    .optional(),
})

export type ReceiptOcrFields = z.infer<typeof receiptOcrFieldsSchema>
export type ReceiptOcrProviderId = 'openai' | 'anthropic'

const PROMPT = `You extract fields from Polish fiscal receipts (paragon fiskalny), invoices, KWIT WZ slips, fuel station documents, and card-payment confirmations (e.g. Polcard / Routex).
Return ONLY valid JSON with keys:
documentKind (string|null) — one of: "fiscal_receipt", "invoice", "wz_slip" (KWIT WZ / release note), "polcard_payment_confirmation", "payment_confirmation", "unknown",
documentNumber (string|null) — receipt/invoice/WZ NUMBER only (e.g. W001776, W001530, WZ26161B02011540, FV/12/2026). NEVER put a NIP here. NEVER use "Nr boczny" / side number (e.g. 0000). On taxi fiscal receipts the W-serial under the plate/boczny block is the document number. For card slips use auth/reference number if present,
grossAmount (number|null) — total gross amount PLN (SUMA / RAZEM / KWOTA / DO ZAPŁATY),
distanceKm (number|null) — trip distance in kilometers if printed,
vatRatePercent (number|null) — VAT rate percent when printed as % (typically 8 or 23). If only VAT amount is shown, leave null,
vatAmount (number|null) — total VAT amount PLN when printed (suma VAT / VAT), even if % is missing,
buyerNip (string|null) — buyer (nabywca) NIP when printed (often "NIP nabywcy" or company block near card confirmation). Accept dashed/compact/PL prefix; prefer digits-only,
sellerNip (string|null) — seller/issuer (sprzedawca) NIP from a labeled NIP line in the HEADER. NEVER use BDO. On KWIT WZ leave null (no issuer NIP). On fuel fiscal receipts this may be the station NIP — NOT the fleet buyer NIP,
registrationPlate (string|null) — vehicle plate when labeled Rejestracja / Nr rejestracyjny (e.g. KK3666G),
occurredAt (ISO date or datetime string|null),
confidence (0..1),
rawExcerpt (short string of key lines — include NIPs, Rejestracja, VAT lines when visible).

Critical rules:
- Taxi fiscal receipts (paragon): TOP/header company "NIP:" is sellerNip (often fleet 9452189152). buyerNip ONLY from an explicit "NIP nabywcy" near the FOOTER when present — leave null on individual trips with blank orderer fields.
- Never put the header seller NIP into buyerNip.
- Expense / fuel / KWIT WZ / BP / Routex: Fleet company NIP (9452189152) under "Nazwa firmy" / buyer block is buyerNip — NEVER sellerNip.
- BDO (Baza Danych o Odpadach) numbers are NOT a NIP — never put BDO into sellerNip or buyerNip.
- KWIT WZ / wz_slip: usually has NO issuer (seller) NIP — leave sellerNip null. Buyer NIP may still be present.
- Fuel station fiscal receipts may have seller NIP in the header; WZ release notes typically do not.
- documentNumber is never a NIP, never a BDO number, and never "Nr boczny" (vehicle side number).
- Taxi paragon: prefer the W##### serial printed near the header (below Nr rejestr. / Nr boczny), not the boczny value itself.
- If VAT % is missing but VAT amount and gross are visible, still return vatAmount and grossAmount (leave vatRatePercent null).
- WZ and card payment slips are valid cost documents — still extract amount, date, plate, buyer NIP when present.
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

/** Disk-backed drivers: OCR may use resolveAttachmentAbsolutePath + fs.readFile. */
export function isLocalAttachmentStorageDriver(key: string | null | undefined): boolean {
  const normalized = (key || 'local').trim()
  return normalized === 'local' || normalized === 'legacyPublic'
}

function isPdfMimeType(mimeType: string | null, pathHint: string): boolean {
  const normalized = (mimeType || '').toLowerCase()
  if (normalized === 'application/pdf') return true
  return path.extname(pathHint).toLowerCase() === '.pdf'
}

function getImageMediaType(mimeType: string | null, pathHint: string): string {
  if (mimeType && mimeType.startsWith('image/')) return mimeType
  const ext = path.extname(pathHint).toLowerCase()
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
  pathHint: string
  mimeType: string | null
  fileBuffer: Buffer
  fileName: string
  sanitizeMode?: ReceiptOcrSanitizeMode
}): Promise<{ fields: ReceiptOcrFields; model: string; provider: ReceiptOcrProviderId }> {
  const model = params.model?.trim() || resolveReceiptOcrModel(params.provider)
  const languageModel = await createReceiptOcrModel(params.provider, model)
  const base64 = params.fileBuffer.toString('base64')

  const result = await generateText({
    model: languageModel,
    messages: [
      {
        role: 'user',
        content: isPdfMimeType(params.mimeType, params.pathHint)
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
                image: `data:${getImageMediaType(params.mimeType, params.pathHint)};base64,${base64}`,
              },
              { type: 'text', text: PROMPT },
            ],
      },
    ],
  })

  const parsed = receiptOcrFieldsSchema.parse(extractJsonObject(result.text))
  return {
    fields: sanitizeReceiptOcrFields(parsed, { mode: params.sanitizeMode ?? 'trip' }),
    model,
    provider: params.provider,
  }
}

export type ExtractReceiptFieldsFromImageParams = {
  mimeType: string | null
  model?: string
  sanitizeMode?: ReceiptOcrSanitizeMode
} & (
  | { filePath: string; fileBuffer?: undefined; fileName?: undefined }
  | { fileBuffer: Buffer; fileName?: string; filePath?: undefined }
)

export async function extractReceiptFieldsFromImage(
  params: ExtractReceiptFieldsFromImageParams,
): Promise<{ fields: ReceiptOcrFields; model: string; provider: ReceiptOcrProviderId }> {
  const chain = resolveReceiptOcrProviderChain()
  if (chain.length === 0) {
    throw new Error('Receipt OCR requires OPENAI_API_KEY or ANTHROPIC_API_KEY')
  }

  let fileBuffer: Buffer
  let fileName: string
  let pathHint: string

  if ('fileBuffer' in params && params.fileBuffer) {
    fileBuffer = params.fileBuffer
    fileName = params.fileName?.trim() || 'receipt.bin'
    pathHint = fileName
  } else if ('filePath' in params && params.filePath) {
    fileBuffer = await fs.readFile(params.filePath)
    fileName = path.basename(params.filePath) || 'receipt.pdf'
    pathHint = params.filePath
  } else {
    throw new Error('Receipt OCR requires filePath or fileBuffer')
  }

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
        pathHint,
        mimeType: params.mimeType,
        fileBuffer,
        fileName,
        sanitizeMode: params.sanitizeMode,
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
