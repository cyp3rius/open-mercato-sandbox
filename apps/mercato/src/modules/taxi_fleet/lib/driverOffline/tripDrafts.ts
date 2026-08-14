import {
  createEmptyPlace,
  type DriverLiveTripDraft,
  type DriverLiveTripPhase,
  type DriverReceiptBlob,
} from './tripTypes'

const DB_NAME = 'taxi-fleet-driver'
const DB_VERSION = 2
const OUTBOX_STORE = 'outbox'
const CACHE_STORE = 'cache'
const LIVE_STORE = 'liveTrips'
const RECEIPT_STORE = 'receiptBlobs'

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `m_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) db.createObjectStore(OUTBOX_STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(CACHE_STORE)) db.createObjectStore(CACHE_STORE, { keyPath: 'key' })
      if (!db.objectStoreNames.contains(LIVE_STORE)) db.createObjectStore(LIVE_STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(RECEIPT_STORE)) db.createObjectStore(RECEIPT_STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | void> {
  const db = await openDb()
  try {
    return await new Promise<T | void>((resolve, reject) => {
      const tx = db.transaction(storeName, mode)
      const store = tx.objectStore(storeName)
      const req = run(store)
      if (!req) {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        return
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

export async function listLiveTripDrafts(): Promise<DriverLiveTripDraft[]> {
  if (typeof indexedDB === 'undefined') return []
  const rows = (await withStore<DriverLiveTripDraft[]>(LIVE_STORE, 'readonly', (store) =>
    store.getAll(),
  )) as DriverLiveTripDraft[]
  return (rows ?? []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getLiveTripDraft(id: string): Promise<DriverLiveTripDraft | null> {
  if (typeof indexedDB === 'undefined') return null
  const row = (await withStore<DriverLiveTripDraft | undefined>(LIVE_STORE, 'readonly', (store) =>
    store.get(id),
  )) as DriverLiveTripDraft | undefined
  return row ?? null
}

export async function getActiveLiveTripDraft(): Promise<DriverLiveTripDraft | null> {
  const all = await listLiveTripDrafts()
  return all.find((draft) => draft.phase === 'active' || draft.phase === 'ended') ?? null
}

export async function upsertLiveTripDraft(
  draft: Omit<DriverLiveTripDraft, 'updatedAt'> & { updatedAt?: string },
): Promise<DriverLiveTripDraft> {
  const next: DriverLiveTripDraft = {
    ...draft,
    updatedAt: draft.updatedAt ?? new Date().toISOString(),
  }
  await withStore(LIVE_STORE, 'readwrite', (store) => {
    store.put(next)
  })
  return next
}

export async function clearLiveTripDraft(id: string): Promise<void> {
  await withStore(LIVE_STORE, 'readwrite', (store) => {
    store.delete(id)
  })
}

export async function startLiveTripDraft(input: {
  from: DriverLiveTripDraft['from']
  resourceId?: string | null
  assignmentId?: string | null
  phase?: DriverLiveTripPhase
}): Promise<DriverLiveTripDraft> {
  const existing = await getActiveLiveTripDraft()
  if (existing) return existing
  const now = new Date().toISOString()
  return upsertLiveTripDraft({
    id: uuid(),
    clientMutationId: uuid(),
    phase: input.phase ?? 'active',
    from: input.from,
    to: createEmptyPlace(),
    waypoints: [],
    startedAt: now,
    endedAt: null,
    distanceKm: null,
    durationText: null,
    track: [],
    serverTripId: null,
    resourceId: input.resourceId ?? null,
    assignmentId: input.assignmentId ?? null,
  })
}

export async function saveReceiptBlob(input: {
  draftRecordId: string
  fileName: string
  mime: string
  dataBase64: string
}): Promise<DriverReceiptBlob> {
  const row: DriverReceiptBlob = {
    id: uuid(),
    draftRecordId: input.draftRecordId,
    fileName: input.fileName,
    mime: input.mime || 'application/octet-stream',
    dataBase64: input.dataBase64,
    createdAt: new Date().toISOString(),
  }
  await withStore(RECEIPT_STORE, 'readwrite', (store) => {
    store.put(row)
  })
  return row
}

export async function getReceiptBlob(id: string): Promise<DriverReceiptBlob | null> {
  if (typeof indexedDB === 'undefined') return null
  const row = (await withStore<DriverReceiptBlob | undefined>(RECEIPT_STORE, 'readonly', (store) =>
    store.get(id),
  )) as DriverReceiptBlob | undefined
  return row ?? null
}

export async function deleteReceiptBlob(id: string): Promise<void> {
  await withStore(RECEIPT_STORE, 'readwrite', (store) => {
    store.delete(id)
  })
}

export function newClientId(): string {
  return uuid()
}
