import type { EntityManager } from '@mikro-orm/postgresql'
import {
  Dictionary,
  DictionaryEntry,
  type DictionaryManagerVisibility,
} from '@open-mercato/core/modules/dictionaries/data/entities'
import { normalizeDictionaryValue } from '@open-mercato/core/modules/dictionaries/lib/utils'
import { PLAYBOOK_PROCEDURE_ACTION_DICTIONARY_KEY } from './dictionaryKeys'
import {
  parseProcedureActionDictionaryOption,
  type ProcedureActionDictionaryOption,
} from './procedureActionDictionary'

type Scope = { tenantId: string; organizationId: string }

const defaults = [
  { value: 'other', label: 'Other', metadata: { notifyInApp: false, notifyViaMessages: false, enabled: true, legacyVariant: 'other' } },
  { value: 'task', label: 'Task', metadata: { notifyInApp: false, notifyViaMessages: false, enabled: true, legacyVariant: 'task' } },
  { value: 'notify', label: 'Notify', metadata: { notifyInApp: true, notifyViaMessages: false, enabled: true, legacyVariant: 'notify' } },
] as const

export async function ensurePlaybookProcedureActionDictionary(
  em: EntityManager,
  scope: Scope,
): Promise<{ dictionaryId: string; items: ProcedureActionDictionaryOption[] }> {
  let dictionary = await em.findOne(Dictionary, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    key: PLAYBOOK_PROCEDURE_ACTION_DICTIONARY_KEY,
    deletedAt: null,
  })
  if (!dictionary) {
    dictionary = em.create(Dictionary, {
      key: PLAYBOOK_PROCEDURE_ACTION_DICTIONARY_KEY,
      name: 'Playbook procedure actions',
      description: 'Actions available in playbook procedures.',
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      isSystem: true,
      isActive: true,
      managerVisibility: 'default' satisfies DictionaryManagerVisibility,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    em.persist(dictionary)
    await em.flush()
  }
  for (const item of defaults) {
    const normalizedValue = normalizeDictionaryValue(item.value)
    if (!normalizedValue) continue
    const existing = await em.findOne(DictionaryEntry, {
      dictionary,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      normalizedValue,
    })
    if (!existing) {
      em.persist(em.create(DictionaryEntry, {
        dictionary,
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        value: item.value,
        normalizedValue,
        label: item.label,
        color: null,
        icon: null,
        isDefault: item.value === 'other',
        metadata: item.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    } else if (item.value === 'other' && !existing.isDefault) {
      existing.isDefault = true
      existing.updatedAt = new Date()
    } else if (item.value !== 'other' && existing.isDefault) {
      existing.isDefault = false
      existing.updatedAt = new Date()
    }
  }
  await em.flush()

  const entries = await em.find(
    DictionaryEntry,
    {
      dictionary,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    },
    { orderBy: { label: 'asc' } },
  )
  const items: ProcedureActionDictionaryOption[] = []
  for (const entry of entries) {
    const option = parseProcedureActionDictionaryOption({
      value: entry.value,
      label: entry.label,
      metadata: entry.metadata ?? null,
    })
    if (option?.enabled) items.push(option)
  }
  items.sort((a, b) => {
    const rank = (v: string) => (v === 'other' ? 0 : v === 'task' ? 1 : v === 'notify' ? 2 : 3)
    return rank(a.value) - rank(b.value) || a.label.localeCompare(b.label)
  })
  return { dictionaryId: dictionary.id, items }
}
