export const PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY = 'procurement.process.status'

export const PROCUREMENT_PROCESS_TYPE_DICTIONARY_KEY = 'procurement.process.type'

/** Catalog units of measure (seeded as dictionary key `unit`). */
export const CATALOG_UNIT_DICTIONARY_KEY = 'unit'

/** Actions available for every process type (merge with type-specific dictionary in UI). */
export const PROCUREMENT_PROCESS_ACTION_DEFAULT_DICTIONARY_KEY = 'procurement.process.action'

/** Type-specific actions: `procurement.process.action.<typeValueNormalized>` (lowercase slug). */
export function procurementActionDictionaryKeyForProcessType(typeValueNormalized: string): string {
  const slug = typeValueNormalized.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9.-]/g, '')
  if (!slug.length) return PROCUREMENT_PROCESS_ACTION_DEFAULT_DICTIONARY_KEY
  return `${PROCUREMENT_PROCESS_ACTION_DEFAULT_DICTIONARY_KEY}.${slug}`
}
