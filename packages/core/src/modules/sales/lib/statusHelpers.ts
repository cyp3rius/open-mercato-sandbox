import type { EntityManager } from '@mikro-orm/postgresql'
import { Dictionary, DictionaryEntry } from '@open-mercato/core/modules/dictionaries/data/entities'
import { normalizeDictionaryValue } from '@open-mercato/core/modules/dictionaries/lib/utils'
import type { SalesDictionaryKind } from './dictionaries'
import { getSalesDictionaryDefinition } from './dictionaries'

/**
 * Resolve the dictionary entry ID for a given sales status value.
 * Defaults to order statuses for backward compatibility.
 */
export async function resolveStatusEntryIdByValue(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    value: string
    kind?: Extract<SalesDictionaryKind, 'order-status' | 'quote-status'>
  },
): Promise<string | null> {
  const kind = params.kind ?? 'order-status'
  const dictionaryKey = getSalesDictionaryDefinition(kind).key
  const normalizedValue = normalizeDictionaryValue(params.value)
  const dictionary = await em.findOne(Dictionary, {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    key: dictionaryKey,
    deletedAt: null,
  })
  if (!dictionary) return null
  const entry = await em.findOne(DictionaryEntry, {
    dictionary,
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    normalizedValue,
  })
  return entry?.id ?? null
}
