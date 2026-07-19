import type { ProcedureActionVariant } from './procedureBlocks'

export type ProcedureActionDictionaryOption = {
  value: string
  label: string
  enabled: boolean
  legacyVariant: ProcedureActionVariant
}

export function resolveProcedureActionVariant(
  actionCode: string | null | undefined,
  legacyVariant?: string | null,
): ProcedureActionVariant {
  const fromMeta =
    legacyVariant === 'notify' || legacyVariant === 'task' || legacyVariant === 'other' ? legacyVariant : null
  if (fromMeta) return fromMeta
  const code = typeof actionCode === 'string' ? actionCode.trim() : ''
  if (code === 'notify' || code === 'task' || code === 'other') return code
  return 'other'
}

export function parseProcedureActionDictionaryOption(
  raw: Record<string, unknown>,
): ProcedureActionDictionaryOption | null {
  const value = typeof raw.value === 'string' ? raw.value.trim() : ''
  if (!value.length) return null
  const label =
    typeof raw.label === 'string' && raw.label.trim().length ? raw.label.trim() : value
  const meta =
    raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)
      ? (raw.metadata as Record<string, unknown>)
      : {}
  const enabled = meta.enabled !== false
  const legacyRaw = typeof meta.legacyVariant === 'string' ? meta.legacyVariant.trim() : ''
  return {
    value,
    label,
    enabled,
    legacyVariant: resolveProcedureActionVariant(value, legacyRaw),
  }
}
