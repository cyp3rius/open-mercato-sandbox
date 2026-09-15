import type { Playbook } from '../../playbooks/data/entities'
import type { ProcedureBlock } from '../../playbooks/lib/procedureBlocks'

export function trimTimelineText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

export function playbookTimelineFields(pb: Playbook): Record<string, unknown> {
  return {
    playbookId: pb.id,
    slug: typeof pb.slug === 'string' ? pb.slug : null,
    title: typeof pb.title === 'string' ? pb.title : null,
    version:
      typeof pb.version === 'number' && Number.isFinite(pb.version) ? Math.trunc(pb.version) : null,
  }
}

export function buildProcedureStepRef(block: ProcedureBlock): Record<string, unknown> {
  const label = trimTimelineText(block.label)
  const sourceStepId = trimTimelineText(block.sourceStepId)
  const base: Record<string, unknown> = {
    blockId: block.id,
    kind: block.kind,
    label,
    ...(sourceStepId ? { sourceStepId } : {}),
  }
  switch (block.kind) {
    case 'action':
      return {
        ...base,
        actionVariant: block.actionVariant,
        instructions: trimTimelineText(block.otherInstructions),
        taskTitle: trimTimelineText(block.taskTitle),
        notifyChannel: block.notifyChannel ?? null,
        notifyTarget: block.notifyTarget ?? null,
        notifyBody: trimTimelineText(block.notifyBody),
        actionCode: trimTimelineText(block.actionCode),
      }
    case 'condition':
      return {
        ...base,
        conditionMode: block.conditionMode === 'verification' ? 'verification' : 'manual',
      }
    case 'goto':
      return {
        ...base,
        targetStepId: typeof block.targetStepId === 'string' ? block.targetStepId : null,
      }
    case 'select_entity':
      return {
        ...base,
        entityKind: block.entityKind,
        required: block.required !== false,
        allowCreate: block.allowCreate === true,
      }
    case 'invoke_procedure':
      return {
        ...base,
        playbookSlugs: Array.isArray(block.playbookSlugs) ? block.playbookSlugs : [],
      }
    default:
      return base
  }
}

export function buildProcedureTimelineRef(options: {
  eventKind: string
  playbook?: Playbook | null
  step?: ProcedureBlock | null
  nextStep?: ProcedureBlock | null
  targetStep?: ProcedureBlock | null
  extras?: Record<string, unknown> | null
}): Record<string, unknown> {
  const ref: Record<string, unknown> = {
    kind: options.eventKind,
    ...(options.extras ?? {}),
  }
  if (options.playbook) {
    ref.playbook = playbookTimelineFields(options.playbook)
  }
  if (options.step) {
    ref.step = buildProcedureStepRef(options.step)
  }
  if (options.nextStep) {
    ref.nextStep = buildProcedureStepRef(options.nextStep)
  }
  if (options.targetStep) {
    ref.targetStep = buildProcedureStepRef(options.targetStep)
  }
  return ref
}
