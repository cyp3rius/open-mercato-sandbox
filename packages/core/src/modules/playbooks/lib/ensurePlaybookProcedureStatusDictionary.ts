import type { EntityManager } from '@mikro-orm/postgresql'
import { Dictionary, DictionaryEntry, type DictionaryManagerVisibility } from '@open-mercato/core/modules/dictionaries/data/entities'
import { normalizeDictionaryValue, sanitizeDictionaryColor, sanitizeDictionaryIcon } from '@open-mercato/core/modules/dictionaries/lib/utils'
import { PLAYBOOK_PROCEDURE_STATUS_DICTIONARY_KEY } from './dictionaryKeys'

type Scope = { tenantId: string; organizationId: string }

const DEFAULT_STATUS_ENTRY = {
  value: 'new',
  label: 'Nowa',
  color: '#64748b' as const,
  icon: 'lucide:circle-dot' as const,
  isDefault: true,
}

/**
 * Idempotent: ensures the dictionary and default “Nowa” entry exist.
 * Used by tenant seed and by the ensure API for existing organizations.
 */
export async function ensurePlaybookProcedureStatusDictionary(
  em: EntityManager,
  scope: Scope,
): Promise<{ dictionaryId: string }> {
  const key = PLAYBOOK_PROCEDURE_STATUS_DICTIONARY_KEY
  let dictionary = await em.findOne(Dictionary, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    key,
    deletedAt: null,
  })
  if (!dictionary) {
    dictionary = em.create(Dictionary, {
      key,
      name: 'Playbook procedure status',
      description:
        'Procedure status and context tags for matching CRM playbooks (procedures) to cases and flows. Default entry: Nowa.',
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

  const normalized = normalizeDictionaryValue(DEFAULT_STATUS_ENTRY.value)
  if (!normalized) {
    return { dictionaryId: dictionary.id }
  }

  const existing = await em.findOne(DictionaryEntry, {
    dictionary,
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    normalizedValue: normalized,
  })
  if (!existing) {
    const color = sanitizeDictionaryColor(DEFAULT_STATUS_ENTRY.color)
    const icon = sanitizeDictionaryIcon(DEFAULT_STATUS_ENTRY.icon)
    const entry = em.create(DictionaryEntry, {
      dictionary,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      value: DEFAULT_STATUS_ENTRY.value,
      normalizedValue: normalized,
      label: DEFAULT_STATUS_ENTRY.label,
      color: color ?? null,
      icon: icon ?? null,
      isDefault: DEFAULT_STATUS_ENTRY.isDefault,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    em.persist(entry)
    await em.flush()
  }

  return { dictionaryId: dictionary.id }
}
