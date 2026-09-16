import {
  DRIVER_LAST_TEAM_MEMBER_STORAGE_KEY,
  loadDriverFleetProfilesCache,
  seedDriverFleetProfilesCache,
} from './driverDataCache'

const DB_NAME = 'taxi-fleet-driver'
const DB_VERSION = 2
const CACHE_NAME_PREFIX = 'taxi-fleet-driver-'

const SESSION_KEYS = [
  // Intentionally omit GPS grant flags — GPS consent must survive logout/login.
  'taxi_fleet.driver.tripsBypassDate',
  'taxi_fleet.driver.localeReloadPl',
] as const

async function clearIndexedDbPreservingFleetProfiles(): Promise<void> {
  if (typeof indexedDB === 'undefined') return

  const fleetProfiles = await loadDriverFleetProfilesCache().catch(() => [])

  await new Promise<void>((resolve) => {
    const openReq = indexedDB.open(DB_NAME, DB_VERSION)
    openReq.onerror = () => resolve()
    openReq.onsuccess = () => {
      const db = openReq.result
      const storeNames = Array.from(db.objectStoreNames)
      if (!storeNames.length) {
        db.close()
        resolve()
        return
      }
      const tx = db.transaction(storeNames, 'readwrite')
      for (const name of storeNames) {
        tx.objectStore(name).clear()
      }
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => {
        db.close()
        resolve()
      }
    }
  })

  // Shared-device fallback: keep the fleet directory so offline settings can
  // rebuild /me after a cache miss (pobranie online odświeża całą listę).
  if (fleetProfiles.length) {
    await seedDriverFleetProfilesCache(fleetProfiles, 'replace').catch(() => undefined)
  }
}

function clearSessionKeys(): void {
  if (typeof sessionStorage === 'undefined') return
  for (const key of SESSION_KEYS) {
    try {
      sessionStorage.removeItem(key)
    } catch {
      // ignore quota / private mode
    }
  }
}

async function clearServiceWorkerCaches(): Promise<void> {
  if (typeof caches === 'undefined') return
  try {
    const keys = await caches.keys()
    await Promise.all(
      keys.filter((key) => key.startsWith(CACHE_NAME_PREFIX)).map((key) => caches.delete(key)),
    )
  } catch {
    // ignore
  }
}

/**
 * Wipes driver-app offline state (live trip drafts, outbox, me/trips cache, receipts)
 * plus session flags. Keeps fleet profiles directory for shared-device offline settings.
 * Best-effort — never throws.
 */
export async function clearDriverLocalData(): Promise<void> {
  clearSessionKeys()
  // Drop last member pointer with the session — do not let the next user inherit /me.
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(DRIVER_LAST_TEAM_MEMBER_STORAGE_KEY)
    }
  } catch {
    // ignore
  }
  await Promise.all([clearIndexedDbPreservingFleetProfiles(), clearServiceWorkerCaches()])
}
