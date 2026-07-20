import type { ProcedureEntityKind } from '../../playbooks/lib/procedureBlocks'

export type CasePlaybookEntitySelection = {
  entityKind: ProcedureEntityKind
  entityId: string
  label?: string | null
}

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
  entitySelectionByBlockId?: Record<string, CasePlaybookEntitySelection>
}

export type CasePlaybookRunMetadata = Omit<CasePlaybookStackFrame, 'invokeBlockId'> & {
  stack?: CasePlaybookStackFrame[]
}

const KEY = 'casePlaybookRun'
const PROCEDURE_ENTITY_KIND_SET = new Set<string>([
  'customer',
  'resource',
  'sales_order',
  'sales_quote',
  'sales_deal',
  'insurance_policy',
])

export function cloneCaseMetadataRow(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? { ...(metadata as Record<string, unknown>) }
    : {}
}

function readStringMap(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const out = Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
  return Object.keys(out).length ? out : undefined
}

function readEntitySelectionMap(value: unknown): Record<string, CasePlaybookEntitySelection> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const out: Record<string, CasePlaybookEntitySelection> = {}
  for (const [blockId, raw] of Object.entries(value)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
    const row = raw as Record<string, unknown>
    const entityKind = typeof row.entityKind === 'string' ? row.entityKind.trim() : ''
    const entityId = typeof row.entityId === 'string' ? row.entityId.trim() : ''
    if (!PROCEDURE_ENTITY_KIND_SET.has(entityKind) || !entityId.length) continue
    const label =
      typeof row.label === 'string' && row.label.trim().length ? row.label.trim() : null
    out[blockId] = {
      entityKind: entityKind as ProcedureEntityKind,
      entityId,
      ...(label ? { label } : {}),
    }
  }
  return Object.keys(out).length ? out : undefined
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
      ...(readStringMap(frame.verificationTaskByConditionId) ? { verificationTaskByConditionId: readStringMap(frame.verificationTaskByConditionId) } : {}),
      ...(readStringMap(frame.actionTaskByActionBlockId) ? { actionTaskByActionBlockId: readStringMap(frame.actionTaskByActionBlockId) } : {}),
      ...(readEntitySelectionMap(frame.entitySelectionByBlockId) ? { entitySelectionByBlockId: readEntitySelectionMap(frame.entitySelectionByBlockId) } : {}),
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
    ...(readStringMap(o.verificationTaskByConditionId) ? { verificationTaskByConditionId: readStringMap(o.verificationTaskByConditionId) } : {}),
    ...(readStringMap(o.actionTaskByActionBlockId) ? { actionTaskByActionBlockId: readStringMap(o.actionTaskByActionBlockId) } : {}),
    ...(readEntitySelectionMap(o.entitySelectionByBlockId) ? { entitySelectionByBlockId: readEntitySelectionMap(o.entitySelectionByBlockId) } : {}),
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
    ...(run.entitySelectionByBlockId && Object.keys(run.entitySelectionByBlockId).length
      ? { entitySelectionByBlockId: run.entitySelectionByBlockId }
      : {}),
  }
  return base
}
