const BYPASS_KEY = 'taxi_fleet.driver.tripsBypassDate'

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export function hasDriverTripsBypass(): boolean {
  if (typeof sessionStorage === 'undefined') return false
  try {
    return sessionStorage.getItem(BYPASS_KEY) === todayKey()
  } catch {
    return false
  }
}

export function enableDriverTripsBypass(): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(BYPASS_KEY, todayKey())
  } catch {
    // ignore quota / private mode
  }
}

export function clearDriverTripsBypass(): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(BYPASS_KEY)
  } catch {
    // ignore
  }
}

/**
 * Trip list/create is available without clock-in (past trips from earlier shifts).
 * Live trips still require an open shift — enforced in create UI + API.
 * Bypass remains for soft “preview” messaging only.
 */
export function canAccessDriverTrips(_input?: {
  shiftStart?: string | null
  bypass?: boolean
}): boolean {
  return true
}
