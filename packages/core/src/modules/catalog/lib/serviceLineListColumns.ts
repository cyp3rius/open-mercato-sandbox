/**
 * Per–service-line (dictionary `code`) configuration for which JSON attribute keys
 * appear as extra columns on the catalog product list. Keys are flat paths on
 * `CatalogProductServiceLineExtension.attributes`.
 */
export type ServiceLineListColumnDef = {
  /** Key in the attributes JSON object (flat only, one segment). */
  attributeKey: string
  /** i18n key for the column header (resolved with useT / resolveTranslations). */
  headerKey: string
}

export const SERVICE_LINE_LIST_COLUMNS_BY_CODE: Record<
  string,
  ServiceLineListColumnDef[]
> = {
  // Example: financing: [{ attributeKey: 'contractTermMonths', headerKey: '...' }]
}

export function getServiceLineListColumnDefs(
  serviceLineCode: string | null | undefined,
): ServiceLineListColumnDef[] {
  if (!serviceLineCode || typeof serviceLineCode !== 'string') return []
  const trimmed = serviceLineCode.trim()
  if (!trimmed.length) return []
  return SERVICE_LINE_LIST_COLUMNS_BY_CODE[trimmed] ?? []
}

export function flattenServiceLineAttributesForList(
  serviceLineCode: string | null | undefined,
  attributes: Record<string, unknown> | null | undefined,
): Record<string, string | number | boolean | null> {
  const defs = getServiceLineListColumnDefs(serviceLineCode)
  if (!defs.length) return {}
  const src = attributes && typeof attributes === 'object' ? attributes : {}
  const out: Record<string, string | number | boolean | null> = {}
  for (const def of defs) {
    const key = def.attributeKey
    const prefixedKey = `sf_${key}`
    const raw = Object.prototype.hasOwnProperty.call(src, key)
      ? (src as Record<string, unknown>)[key]
      : undefined
    if (raw === undefined || raw === null) {
      out[prefixedKey] = null
      continue
    }
    if (
      typeof raw === 'string' ||
      typeof raw === 'number' ||
      typeof raw === 'boolean'
    ) {
      out[prefixedKey] = raw
    } else {
      out[prefixedKey] = JSON.stringify(raw)
    }
  }
  return out
}
