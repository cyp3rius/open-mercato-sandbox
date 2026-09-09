export const VEHICLE_PLATE_CUSTOM_FIELD_KEY = 'vehicle_plate'

function normalizePlateKey(value: string): string {
  return value.replace(/[\s-]/g, '').toUpperCase()
}

/** Removes a trailing plate (and optional ` · `/` - ` separator) from a vehicle name. */
export function stripPlateFromVehicleName(
  name: string | null | undefined,
  plate: string | null | undefined,
): string {
  const trimmedName = typeof name === 'string' ? name.trim() : ''
  const trimmedPlate = typeof plate === 'string' ? plate.trim() : ''
  if (!trimmedName) return ''
  if (!trimmedPlate) return trimmedName

  const plateKey = normalizePlateKey(trimmedPlate)
  if (!plateKey.length) return trimmedName

  const nameKey = normalizePlateKey(trimmedName)
  if (nameKey === plateKey) return ''

  // Strip trailing " · PLATE" / " - PLATE" / " PLATE" (spacing variants).
  const escapedPlate = trimmedPlate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')
  const trailing = new RegExp(
    `(?:\\s*[·\\-|–—]\\s*|\\s+)${escapedPlate}\\s*$`,
    'i',
  )
  let cleaned = trimmedName.replace(trailing, '').trim()
  if (normalizePlateKey(cleaned) === plateKey) return ''

  // If plate appears anywhere after normalization (e.g. "Toyota KK3666G"), drop the plate token from the end.
  if (normalizePlateKey(cleaned).endsWith(plateKey) && cleaned.length > trimmedPlate.length) {
    const withoutPlate = cleaned
      .replace(new RegExp(`${escapedPlate}\\s*$`, 'i'), '')
      .replace(/[\s·\-–—]+$/g, '')
      .trim()
    if (withoutPlate && normalizePlateKey(withoutPlate) !== plateKey) {
      cleaned = withoutPlate
    }
  }

  return cleaned
}

export function formatVehicleResourceLabel(
  name: string | null | undefined,
  plate: string | null | undefined,
): string {
  const trimmedName = typeof name === 'string' ? name.trim() : ''
  const trimmedPlate = typeof plate === 'string' ? plate.trim() : ''
  const cleanedName = stripPlateFromVehicleName(name, plate)
  if (cleanedName && trimmedPlate) return `${cleanedName} · ${trimmedPlate}`
  if (cleanedName) return cleanedName
  // Name was only the plate (possibly different spacing) — keep one representation.
  if (trimmedName && trimmedPlate && normalizePlateKey(trimmedName) === normalizePlateKey(trimmedPlate)) {
    return trimmedName
  }
  return trimmedPlate || trimmedName
}

export function readVehiclePlateFromResourceRow(row: Record<string, unknown> | null | undefined): string | null {
  if (!row || typeof row !== 'object') return null
  const direct =
    readPlateValue(row[`cf_${VEHICLE_PLATE_CUSTOM_FIELD_KEY}`]) ??
    readPlateValue(row[`cf:${VEHICLE_PLATE_CUSTOM_FIELD_KEY}`]) ??
    readPlateValue(row[VEHICLE_PLATE_CUSTOM_FIELD_KEY])
  if (direct) return direct

  const customFields = row.customFields
  if (customFields && typeof customFields === 'object' && !Array.isArray(customFields)) {
    const map = customFields as Record<string, unknown>
    return (
      readPlateValue(map[VEHICLE_PLATE_CUSTOM_FIELD_KEY]) ??
      readPlateValue(map[`cf_${VEHICLE_PLATE_CUSTOM_FIELD_KEY}`])
    )
  }
  if (Array.isArray(customFields)) {
    for (const entry of customFields) {
      if (!entry || typeof entry !== 'object') continue
      const item = entry as Record<string, unknown>
      const key = typeof item.key === 'string' ? item.key.replace(/^cf_/, '') : ''
      if (key !== VEHICLE_PLATE_CUSTOM_FIELD_KEY) continue
      return readPlateValue(item.value)
    }
  }
  return null
}

function readPlateValue(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}
