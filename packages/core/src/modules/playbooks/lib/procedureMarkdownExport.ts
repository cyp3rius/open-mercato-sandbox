import { stringify as stringifyYaml } from 'yaml'
import type { ProcedureDuration } from './duration'
import type { ProcedureBlock } from './procedureBlocks'
import type { PlaybookUpsertPayload, ProcedureMarkdownMeta } from './procedureMarkdown'

export type ExportPlaybookInput = {
  slug: string
  title: string
  body?: string | null
  audience?: ProcedureMarkdownMeta['audience'] | null
  contextTags?: string[] | null
  defaultSlaDuration?: ProcedureDuration | null
  recommendedOwnerUserIds?: string[] | null
  procedureDefinition: ProcedureBlock[]
}

type ExportStep = Record<string, unknown>

function slugifyLabel(label: string | null | undefined, fallback: string): string {
  const base = (label ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return base.length > 0 ? base : fallback
}

function allocateLocalIds(blocks: ProcedureBlock[]): Map<string, string> {
  const uuidToLocal = new Map<string, string>()
  const used = new Set<string>()

  const claim = (preferred: string, uuid: string): string => {
    let candidate = preferred
    let n = 2
    while (used.has(candidate)) {
      candidate = `${preferred}-${n}`
      n += 1
    }
    used.add(candidate)
    uuidToLocal.set(uuid, candidate)
    return candidate
  }

  const walk = (arr: ProcedureBlock[]) => {
    for (const block of arr) {
      const fromSource =
        typeof block.sourceStepId === 'string' && block.sourceStepId.trim().length > 0
          ? block.sourceStepId.trim().toLowerCase()
          : null
      const preferred =
        fromSource ??
        slugifyLabel(block.label, `${block.kind}-${block.id.replace(/-/g, '').slice(0, 8)}`)
      claim(preferred, block.id)
      if (block.kind === 'condition') {
        walk(block.yes)
        walk(block.no)
      }
    }
  }
  walk(blocks)
  return uuidToLocal
}

function exportStep(block: ProcedureBlock, uuidToLocal: Map<string, string>): ExportStep {
  const localId = uuidToLocal.get(block.id) ?? block.id
  const step: ExportStep = {
    id: localId,
    kind: block.kind,
  }
  if (typeof block.label === 'string' && block.label.length > 0) {
    step.label = block.label
  }

  switch (block.kind) {
    case 'start':
    case 'end':
      return step
    case 'action':
      step.actionVariant = block.actionVariant
      if (block.actionCode) step.actionCode = block.actionCode
      if (block.notifyChannel) step.notifyChannel = block.notifyChannel
      if (block.notifyTarget) step.notifyTarget = block.notifyTarget
      if (block.notifyBody) step.notifyBody = block.notifyBody
      if (block.taskTitle) step.taskTitle = block.taskTitle
      if (block.otherInstructions) step.otherInstructions = block.otherInstructions
      return step
    case 'condition':
      if (block.conditionMode) step.conditionMode = block.conditionMode
      if (block.verificationUserId) step.verificationUserId = block.verificationUserId
      step.yes = block.yes.map((child) => exportStep(child, uuidToLocal))
      step.no = block.no.map((child) => exportStep(child, uuidToLocal))
      return step
    case 'goto': {
      const targetLocal = uuidToLocal.get(block.targetStepId)
      if (!targetLocal) {
        throw new Error(`procedureMarkdown.exportUnknownGotoTarget:${block.targetStepId}`)
      }
      step.target = targetLocal
      return step
    }
    case 'invoke_procedure':
      step.playbookSlugs = [...(block.playbookSlugs ?? [])]
      if (block.slaDuration) step.slaDuration = block.slaDuration
      return step
    case 'select_entity':
      step.entityKind = block.entityKind
      if (block.required === false) step.required = false
      if (block.allowCreate === false) step.allowCreate = false
      return step
  }
}

export function exportProcedureSteps(blocks: ProcedureBlock[]): ExportStep[] {
  const uuidToLocal = allocateLocalIds(blocks)
  return blocks.map((block) => exportStep(block, uuidToLocal))
}

function buildFrontmatter(input: ExportPlaybookInput): Record<string, unknown> {
  const fm: Record<string, unknown> = {
    slug: input.slug.trim().toLowerCase(),
    title: input.title,
  }
  const audience = input.audience ?? 'internal'
  if (audience !== 'internal') fm.audience = audience
  else fm.audience = audience
  if (input.contextTags?.length) fm.contextTags = [...input.contextTags]
  if (input.defaultSlaDuration) fm.defaultSlaDuration = input.defaultSlaDuration
  if (input.recommendedOwnerUserIds?.length) {
    fm.recommendedOwnerUserIds = [...input.recommendedOwnerUserIds]
  }
  return fm
}

/** Serialize playbook fields + procedureDefinition to Markdown (frontmatter + ## Procedure). */
export function exportProcedureDocument(input: ExportPlaybookInput): string {
  const frontmatter = stringifyYaml(buildFrontmatter(input), {
    lineWidth: 0,
    defaultStringType: 'PLAIN',
    defaultKeyType: 'PLAIN',
  }).trimEnd()
  const steps = exportProcedureSteps(input.procedureDefinition)
  const procedureYaml = stringifyYaml(steps, {
    lineWidth: 0,
    defaultStringType: 'PLAIN',
    defaultKeyType: 'PLAIN',
  }).trimEnd()
  const body = (input.body ?? '').trim()
  const parts = [`---\n${frontmatter}\n---`]
  if (body) parts.push('', body)
  parts.push('', '## Procedure', '', procedureYaml, '')
  return parts.join('\n')
}

export function exportPlaybookUpsertPayload(payload: PlaybookUpsertPayload): string {
  return exportProcedureDocument(payload)
}
