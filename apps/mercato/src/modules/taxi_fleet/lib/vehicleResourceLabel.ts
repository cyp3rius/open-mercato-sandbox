export const VEHICLE_PLATE_CUSTOM_FIELD_KEY = 'vehicle_plate'

function normalizePlateKey(value: string): string {
  return value.replace(/[\s-]/g, '').toUpperCase()
}

export function formatVehicleResourceLabel(
  name: string | null | undefined,
  plate: string | null | undefined,
): string {
  const trimmedName = typeof name === 'string' ? name.trim() : ''
  const trimmedPlate = typeof plate === 'string' ? plate.trim() : ''
  if (trimmedName && trimmedPlate) {
    const nameKey = normalizePlateKey(trimmedName)
    const plateKey = normalizePlateKey(trimmedPlate)
    if (!plateKey.length) return trimmedName
    if (nameKey === plateKey || nameKey.includes(plateKey)) return trimmedName
    return `${trimmedName} · ${trimmedPlate}`
  }
  return trimmedName || trimmedPlate
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
