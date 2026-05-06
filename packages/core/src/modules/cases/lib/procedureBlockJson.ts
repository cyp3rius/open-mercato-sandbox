import type { ProcedureBlock } from '../../playbooks/lib/procedureBlocks'

/** Serializable procedure step for case procedure API (client translates labels). */
export type CaseProcedureBlockJson =
  | {
      id: string
      kind: 'start'
      label: string | null
    }
  | {
      id: string
      kind: 'end'
      label: string | null
    }
  | {
      id: string
      kind: 'action'
      label: string | null
      actionVariant: 'notify' | 'task' | 'other'
      notifyChannel: 'email' | 'whatsapp' | 'message' | null
      notifyTarget: 'customer' | 'owner' | null
      notifyBody: string | null
      taskTitle: string | null
      otherInstructions: string | null
    }
  | {
      id: string
      kind: 'condition'
      label: string | null
      conditionMode: 'manual' | 'verification' | null
      verificationUserId: string | null
    }
  | {
      id: string
      kind: 'goto'
      label: string | null
      targetStepId: string | null
    }
  | {
      id: string
      kind: 'invoke_procedure'
      label: string | null
      playbookSlugs: string[]
    }

export function procedureBlockToCaseJson(block: ProcedureBlock): CaseProcedureBlockJson {
  switch (block.kind) {
    case 'start':
      return { id: block.id, kind: 'start', label: block.label?.trim() ? block.label.trim() : null }
    case 'end':
      return { id: block.id, kind: 'end', label: block.label?.trim() ? block.label.trim() : null }
    case 'action':
      return {
        id: block.id,
        kind: 'action',
        label: block.label?.trim() ? block.label.trim() : null,
        actionVariant: block.actionVariant,
        notifyChannel: block.notifyChannel ?? null,
        notifyTarget: block.notifyTarget ?? null,
        notifyBody: block.notifyBody?.trim() ? block.notifyBody : null,
        taskTitle: block.taskTitle?.trim() ? block.taskTitle : null,
        otherInstructions: block.otherInstructions?.trim() ? block.otherInstructions : null,
      }
    case 'condition':
      return {
        id: block.id,
        kind: 'condition',
        label: block.label?.trim() ? block.label.trim() : null,
        conditionMode: block.conditionMode === 'verification' ? 'verification' : block.conditionMode === 'manual' ? 'manual' : null,
        verificationUserId:
          typeof block.verificationUserId === 'string' && block.verificationUserId.trim().length
            ? block.verificationUserId.trim()
            : null,
      }
    case 'goto':
      return {
        id: block.id,
        kind: 'goto',
        label: block.label?.trim() ? block.label.trim() : null,
        targetStepId: typeof block.targetStepId === 'string' && block.targetStepId.trim() ? block.targetStepId.trim() : null,
      }
    case 'invoke_procedure':
      return {
        id: block.id,
        kind: 'invoke_procedure',
        label: block.label?.trim() ? block.label.trim() : null,
        playbookSlugs: Array.isArray(block.playbookSlugs) ? [...block.playbookSlugs] : [],
      }
  }
}
