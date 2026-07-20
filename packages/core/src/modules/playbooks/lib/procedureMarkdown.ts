import { createHash } from 'node:crypto'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import { procedureDurationSchema, type ProcedureDuration } from './duration'
import {
  procedureBlocksArraySchema,
  type ProcedureActionVariant,
  type ProcedureBlock,
  type ProcedureConditionMode,
  type ProcedureEntityKind,
  type ProcedureNotifyChannel,
  type ProcedureNotifyTarget,
  PROCEDURE_ENTITY_KINDS,
} from './procedureBlocks'

/** DNS namespace UUID — deterministic UUID v5 for procedure step ids. */
export const PROCEDURE_STEP_UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

const stepIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'step id must be kebab-case')

const blockIdSchema = z.string().uuid()

export const procedureMarkdownMetaSchema = z.object({
  slug: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(500),
  audience: z.enum(['internal', 'customer_facing', 'both']).optional().default('internal'),
  contextTags: z.array(z.string().trim().min(1).max(80)).optional().default([]),
  defaultSlaDuration: procedureDurationSchema.optional().nullable(),
  recommendedOwnerUserIds: z.array(z.string().uuid()).optional().default([]),
})

export type ProcedureMarkdownMeta = z.infer<typeof procedureMarkdownMetaSchema>

export type RawProcedureStep = {
  id: string
  kind: string
  blockId?: string | null
  label?: string | null
  actionVariant?: string | null
  actionCode?: string | null
  notifyChannel?: string | null
  notifyTarget?: string | null
  notifyBody?: string | null
  taskTitle?: string | null
  otherInstructions?: string | null
  conditionMode?: string | null
  verificationUserId?: string | null
  yes?: RawProcedureStep[]
  no?: RawProcedureStep[]
  target?: string | null
  targetStepId?: string | null
  playbookSlugs?: string[]
  slaDuration?: ProcedureDuration | null
  entityKind?: string | null
  required?: boolean | null
  allowCreate?: boolean | null
}

export type ParsedProcedureMarkdown = {
  meta: ProcedureMarkdownMeta
  bodyMarkdown: string
  steps: RawProcedureStep[]
}

export type PlaybookUpsertPayload = {
  slug: string
  title: string
  body: string
  audience: 'internal' | 'customer_facing' | 'both'
  contextTags: string[]
  defaultSlaDuration: ProcedureDuration | null
  recommendedOwnerUserIds: string[]
  procedureDefinition: ProcedureBlock[]
}

function uuidToBytes(uuid: string): Buffer {
  const hex = uuid.replace(/-/g, '')
  if (hex.length !== 32) throw new Error(`Invalid UUID namespace: ${uuid}`)
  return Buffer.from(hex, 'hex')
}

function bytesToUuid(bytes: Buffer): string {
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

/** RFC 4122 UUID v5 from namespace UUID + name. */
export function uuidV5FromName(name: string, namespace: string = PROCEDURE_STEP_UUID_NAMESPACE): string {
  const nsBytes = uuidToBytes(namespace)
  const hash = createHash('sha1').update(Buffer.concat([nsBytes, Buffer.from(name, 'utf8')])).digest()
  hash[6] = (hash[6]! & 0x0f) | 0x50
  hash[8] = (hash[8]! & 0x3f) | 0x80
  return bytesToUuid(hash.subarray(0, 16))
}

export function procedureStepUuid(playbookSlug: string, stepId: string): string {
  const slug = playbookSlug.trim().toLowerCase()
  const id = stepId.trim().toLowerCase()
  return uuidV5FromName(`${slug}/${id}`)
}

function resolveStepBlockUuid(step: RawProcedureStep, playbookSlug: string, localId: string): string {
  // Legacy MD may still carry blockId from older exports; honour it when present.
  // New exports omit blockId — canonical identity is UUID v5(slug/localId).
  const rawBlockId = typeof step.blockId === 'string' ? step.blockId.trim() : ''
  if (rawBlockId) {
    const parsed = blockIdSchema.safeParse(rawBlockId)
    if (!parsed.success) {
      throw new Error(`procedureMarkdown.invalidBlockId:${localId}`)
    }
    return parsed.data
  }
  return procedureStepUuid(playbookSlug, localId)
}

function splitFrontmatter(source: string): { frontmatter: string; content: string } {
  const text = source.replace(/^\uFEFF/, '')
  if (!text.startsWith('---')) {
    return { frontmatter: '', content: text }
  }
  const end = text.indexOf('\n---', 3)
  if (end < 0) {
    throw new Error('procedureMarkdown.unclosedFrontmatter')
  }
  const frontmatter = text.slice(3, end).replace(/^\n/, '')
  let content = text.slice(end + 4)
  if (content.startsWith('\n')) content = content.slice(1)
  return { frontmatter, content }
}

function extractProcedureSection(content: string): { bodyMarkdown: string; procedureYaml: string } {
  const match = content.match(/^##\s+Procedure\s*$/m)
  if (!match || match.index === undefined) {
    throw new Error('procedureMarkdown.missingProcedureSection')
  }
  const bodyMarkdown = content.slice(0, match.index).trimEnd()
  const afterHeading = content.slice(match.index + match[0].length)
  const nextHeading = afterHeading.match(/\n##\s+\S/)
  const procedureYaml = (nextHeading ? afterHeading.slice(0, nextHeading.index) : afterHeading).trim()
  if (!procedureYaml) {
    throw new Error('procedureMarkdown.emptyProcedureSection')
  }
  return { bodyMarkdown: bodyMarkdown.trim(), procedureYaml }
}

function asRawSteps(value: unknown): RawProcedureStep[] {
  if (!Array.isArray(value)) {
    throw new Error('procedureMarkdown.procedureMustBeArray')
  }
  return value as RawProcedureStep[]
}

/** Map local kebab-case step id → resolved block UUID. */
function collectLocalIdToUuid(
  steps: RawProcedureStep[],
  playbookSlug: string,
): Map<string, string> {
  const map = new Map<string, string>()
  const usedUuids = new Set<string>()
  const walk = (arr: RawProcedureStep[], prefix: string[]) => {
    arr.forEach((step, index) => {
      const parsedId = stepIdSchema.safeParse(step.id)
      if (!parsedId.success) {
        throw new Error(`procedureMarkdown.invalidStepId:${[...prefix, index].join('.')}`)
      }
      const localId = parsedId.data
      if (map.has(localId)) {
        throw new Error(`procedureMarkdown.duplicateStepId:${localId}`)
      }
      const uuid = resolveStepBlockUuid(step, playbookSlug, localId)
      if (usedUuids.has(uuid)) {
        throw new Error(`procedureMarkdown.duplicateBlockId:${uuid}`)
      }
      usedUuids.add(uuid)
      map.set(localId, uuid)
      if (Array.isArray(step.yes)) walk(step.yes, [...prefix, String(index), 'yes'])
      if (Array.isArray(step.no)) walk(step.no, [...prefix, String(index), 'no'])
    })
  }
  walk(steps, [])
  return map
}

function compileStep(
  step: RawProcedureStep,
  playbookSlug: string,
  localIdToUuid: Map<string, string>,
): ProcedureBlock {
  const localId = stepIdSchema.parse(step.id)
  const id = localIdToUuid.get(localId) ?? resolveStepBlockUuid(step, playbookSlug, localId)
  const label = typeof step.label === 'string' ? step.label : ''
  const sourceStepId = localId

  switch (step.kind) {
    case 'start':
      return { id, kind: 'start', label, sourceStepId }
    case 'end':
      return { id, kind: 'end', label, sourceStepId }
    case 'action': {
      const actionVariant = (step.actionVariant ?? 'other') as ProcedureActionVariant
      return {
        id,
        kind: 'action',
        label,
        sourceStepId,
        actionVariant,
        actionCode: step.actionCode ?? actionVariant,
        notifyChannel: (step.notifyChannel ?? null) as ProcedureNotifyChannel | null,
        notifyTarget: (step.notifyTarget ?? null) as ProcedureNotifyTarget | null,
        notifyBody: step.notifyBody ?? null,
        taskTitle: step.taskTitle ?? null,
        otherInstructions: step.otherInstructions ?? null,
      }
    }
    case 'condition':
      return {
        id,
        kind: 'condition',
        label,
        sourceStepId,
        conditionMode: (step.conditionMode ?? 'manual') as ProcedureConditionMode,
        verificationUserId: step.verificationUserId?.trim() ? step.verificationUserId : null,
        yes: Array.isArray(step.yes)
          ? step.yes.map((child) => compileStep(child, playbookSlug, localIdToUuid))
          : [],
        no: Array.isArray(step.no)
          ? step.no.map((child) => compileStep(child, playbookSlug, localIdToUuid))
          : [],
      }
    case 'goto': {
      const targetLocal = String(step.target ?? step.targetStepId ?? '').trim()
      if (!targetLocal || !localIdToUuid.has(targetLocal)) {
        throw new Error(`procedureMarkdown.unknownGotoTarget:${targetLocal || '(empty)'}`)
      }
      return {
        id,
        kind: 'goto',
        label,
        sourceStepId,
        targetStepId: localIdToUuid.get(targetLocal)!,
      }
    }
    case 'invoke_procedure': {
      const playbookSlugs = Array.isArray(step.playbookSlugs)
        ? step.playbookSlugs.map((s) => String(s).trim().toLowerCase()).filter(Boolean)
        : []
      return {
        id,
        kind: 'invoke_procedure',
        label,
        sourceStepId,
        playbookSlugs,
        slaDuration: step.slaDuration ?? null,
      }
    }
    case 'select_entity': {
      const entityKindRaw = typeof step.entityKind === 'string' ? step.entityKind.trim() : ''
      if (!(PROCEDURE_ENTITY_KINDS as readonly string[]).includes(entityKindRaw)) {
        throw new Error(`procedureMarkdown.invalidEntityKind:${entityKindRaw || '(empty)'}`)
      }
      return {
        id,
        kind: 'select_entity',
        label,
        sourceStepId,
        entityKind: entityKindRaw as ProcedureEntityKind,
        required: step.required === false ? false : true,
        allowCreate: step.allowCreate === false ? false : true,
      }
    }
    default:
      throw new Error(`procedureMarkdown.unknownKind:${step.kind}`)
  }
}

export function parseProcedureMarkdown(source: string): ParsedProcedureMarkdown {
  const { frontmatter, content } = splitFrontmatter(source)
  if (!frontmatter.trim()) {
    throw new Error('procedureMarkdown.missingFrontmatter')
  }
  const rawMeta = parseYaml(frontmatter)
  const meta = procedureMarkdownMetaSchema.parse(rawMeta)
  meta.slug = meta.slug.trim().toLowerCase()

  const { bodyMarkdown, procedureYaml } = extractProcedureSection(content)
  const parsedYaml = parseYaml(procedureYaml)
  const steps = asRawSteps(parsedYaml)

  return { meta, bodyMarkdown, steps }
}

export function compileProcedureSteps(playbookSlug: string, steps: RawProcedureStep[]): ProcedureBlock[] {
  const localIdToUuid = collectLocalIdToUuid(steps, playbookSlug)
  return steps.map((step) => compileStep(step, playbookSlug, localIdToUuid))
}

export function compileProcedureDocument(source: string): PlaybookUpsertPayload {
  const parsed = parseProcedureMarkdown(source)
  const procedureDefinition = compileProcedureSteps(parsed.meta.slug, parsed.steps)
  const validated = procedureBlocksArraySchema.parse(procedureDefinition)
  return {
    slug: parsed.meta.slug,
    title: parsed.meta.title,
    body: parsed.bodyMarkdown,
    audience: parsed.meta.audience,
    contextTags: parsed.meta.contextTags ?? [],
    defaultSlaDuration: parsed.meta.defaultSlaDuration ?? null,
    recommendedOwnerUserIds: parsed.meta.recommendedOwnerUserIds ?? [],
    procedureDefinition: validated as ProcedureBlock[],
  }
}
