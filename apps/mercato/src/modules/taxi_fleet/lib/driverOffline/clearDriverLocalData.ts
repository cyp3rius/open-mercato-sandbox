const DB_NAME = 'taxi-fleet-driver'
const DB_VERSION = 2
const CACHE_NAME = 'taxi-fleet-driver-v3'

const SESSION_KEYS = [
  'taxi_fleet_driver_gps_ready',
  'taxi_fleet.driver.tripsBypassDate',
  'taxi_fleet.driver.localeReloadPl',
] as const

async function clearIndexedDb(): Promise<void> {
  if (typeof indexedDB === 'undefined') return

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

async function clearServiceWorkerCache(): Promise<void> {
  if (typeof caches === 'undefined') return
  try {
    await caches.delete(CACHE_NAME)
  } catch {
    // ignore
  }
}

/**
 * Wipes driver-app offline state (live trip drafts, outbox, cache, receipts)
 * plus session flags. Best-effort — never throws.
 */
export async function clearDriverLocalData(): Promise<void> {
  clearSessionKeys()
  await Promise.all([clearIndexedDb(), clearServiceWorkerCache()])
}
