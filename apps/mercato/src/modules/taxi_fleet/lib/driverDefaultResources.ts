const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

/**
 * Dual-read: prefer `defaultResourceIds`, fall back to singular `defaultResourceId`.
 * Dedupes and drops invalid entries. First id is the primary default.
 */
export function resolveDriverDefaultResourceIds(profile: {
  defaultResourceIds?: string[] | null
  defaultResourceId?: string | null
}): string[] {
  const fromList = Array.isArray(profile.defaultResourceIds)
    ? profile.defaultResourceIds
        .map((id) => (typeof id === 'string' ? id.trim() : ''))
        .filter((id) => id.length > 0 && isUuid(id))
    : []
  if (fromList.length) {
    const seen = new Set<string>()
    const unique: string[] = []
    for (const id of fromList) {
      if (seen.has(id)) continue
      seen.add(id)
      unique.push(id)
    }
    return unique
  }
  const singular = profile.defaultResourceId?.trim()
  if (singular && isUuid(singular)) return [singular]
  return []
}

/**
 * Dual-write shape for profile create/update: list + singular primary.
 */
export function normalizeDriverDefaultResources(input: {
  defaultResourceIds?: string[] | null
  defaultResourceId?: string | null
}): { defaultResourceIds: string[] | null; defaultResourceId: string | null } {
  const ids = resolveDriverDefaultResourceIds({
    defaultResourceIds: input.defaultResourceIds,
    defaultResourceId:
      input.defaultResourceIds !== undefined ? null : input.defaultResourceId,
  })
  // When only singular is sent (legacy clients), resolveDriverDefaultResourceIds already
  // falls back — but if defaultResourceIds is explicitly [] we clear both.
  if (input.defaultResourceIds !== undefined) {
    const fromExplicit = Array.isArray(input.defaultResourceIds)
      ? input.defaultResourceIds
          .map((id) => (typeof id === 'string' ? id.trim() : ''))
          .filter((id) => id.length > 0 && isUuid(id))
      : []
    const seen = new Set<string>()
    const unique: string[] = []
    for (const id of fromExplicit) {
      if (seen.has(id)) continue
      seen.add(id)
      unique.push(id)
    }
    return {
      defaultResourceIds: unique.length ? unique : null,
      defaultResourceId: unique[0] ?? null,
    }
  }
  return {
    defaultResourceIds: ids.length ? ids : null,
    defaultResourceId: ids[0] ?? null,
  }
}

export type ShiftStartVehicleResult =
  | { ok: true; resourceId: string }
  | { ok: false; code: 'SHIFT_VEHICLE_REQUIRED' | 'SHIFT_VEHICLE_NOT_ALLOWED' }

/**
 * Defaults available for shift start: profile defaults minus vehicles already
 * assigned today (own current assignment is treated as available via exclude).
 */
export function filterAvailableDefaultResourceIds(
  defaultResourceIds: string[],
  busyResourceIds: Iterable<string>,
): string[] {
  const busy = new Set(
    [...busyResourceIds].map((id) => id.trim()).filter((id) => id.length > 0),
  )
  return defaultResourceIds.filter((id) => !busy.has(id))
}

/**
 * Shift-start picker list: only profile defaults that are free for the day.
 */
export function buildShiftStartAllowlist(input: {
  defaultResourceIds: string[]
  busyResourceIds?: Iterable<string>
}): string[] {
  return filterAvailableDefaultResourceIds(
    input.defaultResourceIds,
    input.busyResourceIds ?? [],
  )
}

/**
 * Shift start always requires an explicit vehicle from the allowlist.
 */
export function resolveShiftStartVehicle(input: {
  allowlist: string[]
  requestedResourceId?: string | null
}): ShiftStartVehicleResult {
  if (!input.allowlist.length) return { ok: false, code: 'SHIFT_VEHICLE_REQUIRED' }
  const chosen = input.requestedResourceId?.trim() || null
  if (!chosen) return { ok: false, code: 'SHIFT_VEHICLE_REQUIRED' }
  if (!input.allowlist.includes(chosen)) return { ok: false, code: 'SHIFT_VEHICLE_NOT_ALLOWED' }
  return { ok: true, resourceId: chosen }
}

/** Prefers assignment vehicle when it is on the allowlist; otherwise first option. */
export function preselectShiftVehicleId(
  allowlistIds: string[],
  assignmentResourceId?: string | null,
): string | null {
  if (!allowlistIds.length) return null
  const assigned = assignmentResourceId?.trim() || null
  if (assigned && allowlistIds.includes(assigned)) return assigned
  return allowlistIds[0] ?? null
}
