export type CasePlaybookRunMetadata = {
  playbookId: string
  /** ISO — set when user clicks Start; playbook cannot be changed afterwards */
  startedAt?: string
  currentBlockId: string | null
  /** condition block id → operations task id (verification) */
  verificationTaskByConditionId?: Record<string, string>
  /** action (task) block id → operations task id (owner-scheduled step task) */
  actionTaskByActionBlockId?: Record<string, string>
}

const KEY = 'casePlaybookRun'

export function cloneCaseMetadataRow(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? { ...(metadata as Record<string, unknown>) }
    : {}
}

export function readCasePlaybookRun(meta: Record<string, unknown> | null | undefined): CasePlaybookRunMetadata | null {
  const raw = meta?.[KEY]
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const playbookId = typeof o.playbookId === 'string' ? o.playbookId.trim() : ''
  if (!playbookId.length) return null
  const currentBlockId =
    typeof o.currentBlockId === 'string' && o.currentBlockId.trim().length ? o.currentBlockId.trim() : null
  const startedAt =
    typeof o.startedAt === 'string' && o.startedAt.trim().length ? o.startedAt.trim() : undefined
  const verificationTaskByConditionId =
    o.verificationTaskByConditionId && typeof o.verificationTaskByConditionId === 'object'
      ? (o.verificationTaskByConditionId as Record<string, string>)
      : undefined
  const actionTaskByActionBlockId =
    o.actionTaskByActionBlockId && typeof o.actionTaskByActionBlockId === 'object'
      ? (o.actionTaskByActionBlockId as Record<string, string>)
      : undefined
  return {
    playbookId,
    startedAt,
    currentBlockId,
    verificationTaskByConditionId,
    actionTaskByActionBlockId,
  }
}

export function writeCasePlaybookRun(
  meta: Record<string, unknown> | null | undefined,
  run: CasePlaybookRunMetadata | null,
): Record<string, unknown> {
  const base = meta && typeof meta === 'object' ? { ...meta } : {}
  if (!run) {
    delete base[KEY]
    return base
  }
  base[KEY] = {
    playbookId: run.playbookId,
    ...(run.startedAt ? { startedAt: run.startedAt } : {}),
    currentBlockId: run.currentBlockId,
    ...(run.verificationTaskByConditionId && Object.keys(run.verificationTaskByConditionId).length
      ? { verificationTaskByConditionId: run.verificationTaskByConditionId }
      : {}),
    ...(run.actionTaskByActionBlockId && Object.keys(run.actionTaskByActionBlockId).length
      ? { actionTaskByActionBlockId: run.actionTaskByActionBlockId }
      : {}),
  }
  return base
}
