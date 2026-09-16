import { cacheDriverJson, readCachedDriverJson } from './outbox'

export const DRIVER_CACHE_KEYS = {
  me: 'driver/me',
  trips: 'driver/trips',
  assignments: 'driver/assignments',
  expenses: 'driver/expenses',
  /** All external-app fleet drivers + default vehicles (survives logout). */
  fleetProfiles: 'driver/fleetProfiles',
} as const

export type DriverCacheKey = (typeof DRIVER_CACHE_KEYS)[keyof typeof DRIVER_CACHE_KEYS]

/** Survives logout — used to rebuild a minimal /me offline from fleetProfiles. */
export const DRIVER_LAST_TEAM_MEMBER_STORAGE_KEY = 'taxi_fleet.driver.lastTeamMemberId'

export type DriverFleetProfileCacheRow = {
  id: string
  teamMemberId: string
  userId?: string | null
  displayName: string
  externalAppEnabled?: boolean
  defaultResourceId?: string | null
  defaultResourceIds?: Array<{
    id: string
    label: string
    name?: string | null
    plate?: string | null
    available?: boolean
  }>
}

export type DriverFleetProfilesCache = {
  items: DriverFleetProfileCacheRow[]
  updatedAt?: string
}

type IdRow = { id: string } & Record<string, unknown>

export function normalizeCachedItemList<T>(
  cached: T[] | { items?: T[] } | null | undefined,
): T[] {
  if (!cached) return []
  if (Array.isArray(cached)) return cached
  return Array.isArray(cached.items) ? cached.items : []
}

/** Merge by `id`: incoming overwrites matching rows; other existing rows are kept. */
export function mergeCachedItemsById<T extends IdRow>(existing: T[], incoming: T[]): T[] {
  if (!incoming.length) return existing
  const byId = new Map<string, T>()
  for (const row of existing) {
    if (row?.id) byId.set(String(row.id), row)
  }
  for (const row of incoming) {
    if (!row?.id) continue
    const id = String(row.id)
    const prev = byId.get(id)
    byId.set(id, prev ? { ...prev, ...row } : row)
  }
  return Array.from(byId.values())
}

export function applyTripPatchToItems<T extends IdRow>(
  items: T[],
  tripId: string,
  patch: Record<string, unknown>,
): T[] {
  const id = String(tripId)
  let found = false
  const next = items.map((row) => {
    if (String(row.id) !== id) return row
    found = true
    return { ...row, ...patch } as T
  })
  if (!found && patch.id) {
    next.unshift({ ...patch, id } as T)
  } else if (!found) {
    next.unshift({ id, ...patch } as T)
  }
  return next
}

export async function rememberDriverSnapshot(key: string, value: unknown): Promise<void> {
  await cacheDriverJson(key, value)
}

export async function loadDriverSnapshot<T>(key: string): Promise<T | null> {
  return readCachedDriverJson<T>(key)
}

export async function seedDriverTripsCache(
  items: IdRow[],
  mode: 'merge' | 'replace' = 'merge',
): Promise<void> {
  if (mode === 'replace') {
    await cacheDriverJson(DRIVER_CACHE_KEYS.trips, { items })
    return
  }
  const cached = await readCachedDriverJson<IdRow[] | { items?: IdRow[] }>(DRIVER_CACHE_KEYS.trips)
  const existing = normalizeCachedItemList(cached)
  const merged = mergeCachedItemsById(existing, items)
  await cacheDriverJson(DRIVER_CACHE_KEYS.trips, { items: merged })
}

export async function patchCachedTrip(
  tripId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  if (!tripId) return
  const cached = await readCachedDriverJson<IdRow[] | { items?: IdRow[] }>(DRIVER_CACHE_KEYS.trips)
  const existing = normalizeCachedItemList(cached)
  const next = applyTripPatchToItems(existing, tripId, patch)
  await cacheDriverJson(DRIVER_CACHE_KEYS.trips, { items: next })
}

export async function seedDriverAssignmentsCache(
  items: IdRow[],
  mode: 'merge' | 'replace' = 'merge',
): Promise<void> {
  if (mode === 'replace') {
    await cacheDriverJson(DRIVER_CACHE_KEYS.assignments, { items })
    return
  }
  const cached = await readCachedDriverJson<IdRow[] | { items?: IdRow[] }>(
    DRIVER_CACHE_KEYS.assignments,
  )
  const existing = normalizeCachedItemList(cached)
  const merged = mergeCachedItemsById(existing, items)
  await cacheDriverJson(DRIVER_CACHE_KEYS.assignments, { items: merged })
}

export async function seedDriverExpensesCache(
  items: IdRow[],
  mode: 'merge' | 'replace' = 'merge',
): Promise<void> {
  if (mode === 'replace') {
    await cacheDriverJson(DRIVER_CACHE_KEYS.expenses, items)
    return
  }
  const cached = await readCachedDriverJson<IdRow[] | { items?: IdRow[] }>(DRIVER_CACHE_KEYS.expenses)
  const existing = normalizeCachedItemList(cached)
  const merged = mergeCachedItemsById(existing, items)
  await cacheDriverJson(DRIVER_CACHE_KEYS.expenses, merged)
}

/** Replace (or merge) the offline fleet driver directory. Fetch always replaces. */
export async function seedDriverFleetProfilesCache(
  items: DriverFleetProfileCacheRow[],
  mode: 'merge' | 'replace' = 'replace',
): Promise<void> {
  if (mode === 'replace') {
    await cacheDriverJson(DRIVER_CACHE_KEYS.fleetProfiles, {
      items,
      updatedAt: new Date().toISOString(),
    } satisfies DriverFleetProfilesCache)
    return
  }
  const cached = await readCachedDriverJson<DriverFleetProfilesCache>(DRIVER_CACHE_KEYS.fleetProfiles)
  const existing = Array.isArray(cached?.items) ? cached.items : []
  const merged = mergeCachedItemsById(existing, items)
  await cacheDriverJson(DRIVER_CACHE_KEYS.fleetProfiles, {
    items: merged,
    updatedAt: new Date().toISOString(),
  } satisfies DriverFleetProfilesCache)
}

export async function loadDriverFleetProfilesCache(): Promise<DriverFleetProfileCacheRow[]> {
  const cached = await readCachedDriverJson<DriverFleetProfilesCache>(DRIVER_CACHE_KEYS.fleetProfiles)
  return Array.isArray(cached?.items) ? cached.items : []
}

export function rememberLastDriverTeamMemberId(teamMemberId: string | null | undefined): void {
  if (typeof localStorage === 'undefined') return
  const id = typeof teamMemberId === 'string' ? teamMemberId.trim() : ''
  try {
    if (!id) {
      localStorage.removeItem(DRIVER_LAST_TEAM_MEMBER_STORAGE_KEY)
      return
    }
    localStorage.setItem(DRIVER_LAST_TEAM_MEMBER_STORAGE_KEY, id)
  } catch {
    // private mode / quota
  }
}

export function readLastDriverTeamMemberId(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const value = localStorage.getItem(DRIVER_LAST_TEAM_MEMBER_STORAGE_KEY)?.trim()
    return value || null
  } catch {
    return null
  }
}

/**
 * Build a minimal /me-shaped snapshot from the fleet directory for offline settings
 * (vehicle defaults) when the durable `driver/me` row is missing.
 */
export function synthesizeMeFromFleetProfile(row: DriverFleetProfileCacheRow): Record<string, unknown> {
  const defaults = Array.isArray(row.defaultResourceIds) ? row.defaultResourceIds : []
  const primary = defaults[0] ?? null
  return {
    member: {
      id: row.teamMemberId,
      displayName: row.displayName,
      userId: row.userId ?? null,
    },
    impersonation: null,
    profile: {
      id: row.id,
      payoutPercent: null,
      defaultResourceId: row.defaultResourceId ?? primary?.id ?? null,
      defaultResourceLabel: primary?.label ?? null,
      defaultResourceName: primary?.name ?? null,
      defaultResourcePlate: primary?.plate ?? null,
      defaultResourceIds: defaults,
      availableDefaultResourceIds: defaults,
      externalAppEnabled: true,
    },
    todayAssignment: null,
  }
}

export function filterCachedTripsForLocalDay<T extends Record<string, unknown>>(
  items: T[],
  dayStart: Date,
  dayEnd: Date,
): T[] {
  const from = dayStart.getTime()
  const to = dayEnd.getTime()
  return items.filter((row) => {
    const raw =
      (typeof row.startedAt === 'string' && row.startedAt) ||
      (typeof row.createdAt === 'string' && row.createdAt) ||
      null
    if (!raw) return true
    const ms = new Date(raw).getTime()
    if (Number.isNaN(ms)) return true
    return ms >= from && ms <= to
  })
}

export function paginateCachedItems<T>(
  items: T[],
  page: number,
  pageSize: number,
): { items: T[]; page: number; pageSize: number; total: number } {
  const safePage = Math.max(1, page)
  const safeSize = Math.max(1, pageSize)
  const total = items.length
  const start = (safePage - 1) * safeSize
  return {
    items: items.slice(start, start + safeSize),
    page: safePage,
    pageSize: safeSize,
    total,
  }
}
