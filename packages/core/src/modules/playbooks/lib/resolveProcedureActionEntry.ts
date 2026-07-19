import type { EntityManager } from '@mikro-orm/postgresql'
import { Dictionary, DictionaryEntry } from '@open-mercato/core/modules/dictionaries/data/entities'
import { normalizeDictionaryValue } from '@open-mercato/core/modules/dictionaries/lib/utils'
import { PLAYBOOK_PROCEDURE_ACTION_DICTIONARY_KEY } from './dictionaryKeys'
import type { ProcedureActionVariant } from './procedureBlocks'

export type ProcedureActionEntryResolved = {
  value: string
  label: string
  notifyInApp: boolean
  notifyViaMessages: boolean
  enabled: boolean
  legacyVariant: ProcedureActionVariant | null
}

function readBool(meta: Record<string, unknown>, key: string, fallback: boolean): boolean {
  return typeof meta[key] === 'boolean' ? meta[key] : fallback
}

export async function resolveProcedureActionEntry(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
  actionCode: string | null | undefined,
): Promise<ProcedureActionEntryResolved | null> {
  const code = typeof actionCode === 'string' ? actionCode.trim() : ''
  if (!code.length) return null
  const normalizedValue = normalizeDictionaryValue(code)
  if (!normalizedValue) return null

  const dictionary = await em.findOne(Dictionary, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    key: PLAYBOOK_PROCEDURE_ACTION_DICTIONARY_KEY,
    deletedAt: null,
  })
  if (!dictionary) return null

  const entry = await em.findOne(DictionaryEntry, {
    dictionary,
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    normalizedValue,
  })
  if (!entry) return null

  const meta =
    entry.metadata && typeof entry.metadata === 'object' && !Array.isArray(entry.metadata)
      ? (entry.metadata as Record<string, unknown>)
      : {}
  const legacyRaw = typeof meta.legacyVariant === 'string' ? meta.legacyVariant.trim() : ''
  const legacyVariant =
    legacyRaw === 'notify' || legacyRaw === 'task' || legacyRaw === 'other'
      ? legacyRaw
      : code === 'notify' || code === 'task' || code === 'other'
        ? code
        : null

  return {
    value: entry.value,
    label: entry.label,
    notifyInApp: readBool(meta, 'notifyInApp', false),
    notifyViaMessages: readBool(meta, 'notifyViaMessages', false),
    enabled: readBool(meta, 'enabled', true),
    legacyVariant,
  }
}
