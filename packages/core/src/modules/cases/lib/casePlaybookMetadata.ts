export type CasePlaybookStackFrame = {
  playbookId: string
  startedAt?: string
  currentBlockId: string | null
  invokeBlockId: string
  procedureOwnerUserId?: string
  procedureDueAt?: string
  procedureOverdueNotifiedAt?: string
  verificationTaskByConditionId?: Record<string, string>
  actionTaskByActionBlockId?: Record<string, string>
}

export type CasePlaybookRunMetadata = Omit<CasePlaybookStackFrame, 'invokeBlockId'> & {
  stack?: CasePlaybookStackFrame[]
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
  const readMap = (value: unknown): Record<string, string> | undefined =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
      : undefined
  const readFrame = (value: unknown): CasePlaybookStackFrame | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const frame = value as Record<string, unknown>
    const framePlaybookId = typeof frame.playbookId === 'string' ? frame.playbookId.trim() : ''
    const invokeBlockId = typeof frame.invokeBlockId === 'string' ? frame.invokeBlockId.trim() : ''
    if (!framePlaybookId || !invokeBlockId) return null
    return {
      playbookId: framePlaybookId,
      currentBlockId: typeof frame.currentBlockId === 'string' && frame.currentBlockId.trim() ? frame.currentBlockId.trim() : null,
      invokeBlockId,
      ...(typeof frame.startedAt === 'string' && frame.startedAt.trim() ? { startedAt: frame.startedAt.trim() } : {}),
      ...(typeof frame.procedureOwnerUserId === 'string' && frame.procedureOwnerUserId.trim() ? { procedureOwnerUserId: frame.procedureOwnerUserId.trim() } : {}),
      ...(typeof frame.procedureDueAt === 'string' && frame.procedureDueAt.trim() ? { procedureDueAt: frame.procedureDueAt.trim() } : {}),
      ...(typeof frame.procedureOverdueNotifiedAt === 'string' && frame.procedureOverdueNotifiedAt.trim() ? { procedureOverdueNotifiedAt: frame.procedureOverdueNotifiedAt.trim() } : {}),
      ...(readMap(frame.verificationTaskByConditionId) ? { verificationTaskByConditionId: readMap(frame.verificationTaskByConditionId) } : {}),
      ...(readMap(frame.actionTaskByActionBlockId) ? { actionTaskByActionBlockId: readMap(frame.actionTaskByActionBlockId) } : {}),
    }
  }
  const stack = Array.isArray(o.stack) ? o.stack.map(readFrame).filter((frame): frame is CasePlaybookStackFrame => frame !== null) : []
  return {
    playbookId,
    startedAt,
    currentBlockId,
    ...(typeof o.procedureOwnerUserId === 'string' && o.procedureOwnerUserId.trim() ? { procedureOwnerUserId: o.procedureOwnerUserId.trim() } : {}),
    ...(typeof o.procedureDueAt === 'string' && o.procedureDueAt.trim() ? { procedureDueAt: o.procedureDueAt.trim() } : {}),
    ...(typeof o.procedureOverdueNotifiedAt === 'string' && o.procedureOverdueNotifiedAt.trim() ? { procedureOverdueNotifiedAt: o.procedureOverdueNotifiedAt.trim() } : {}),
    ...(stack.length ? { stack } : {}),
    ...(readMap(o.verificationTaskByConditionId) ? { verificationTaskByConditionId: readMap(o.verificationTaskByConditionId) } : {}),
    ...(readMap(o.actionTaskByActionBlockId) ? { actionTaskByActionBlockId: readMap(o.actionTaskByActionBlockId) } : {}),
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
    ...(run.procedureOwnerUserId ? { procedureOwnerUserId: run.procedureOwnerUserId } : {}),
    ...(run.procedureDueAt ? { procedureDueAt: run.procedureDueAt } : {}),
    ...(run.procedureOverdueNotifiedAt ? { procedureOverdueNotifiedAt: run.procedureOverdueNotifiedAt } : {}),
    ...(run.stack?.length ? { stack: run.stack } : {}),
    ...(run.verificationTaskByConditionId && Object.keys(run.verificationTaskByConditionId).length
      ? { verificationTaskByConditionId: run.verificationTaskByConditionId }
      : {}),
    ...(run.actionTaskByActionBlockId && Object.keys(run.actionTaskByActionBlockId).length
      ? { actionTaskByActionBlockId: run.actionTaskByActionBlockId }
      : {}),
  }
  return base
}
