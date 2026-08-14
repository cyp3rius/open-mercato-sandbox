import { deleteReceiptBlob, getReceiptBlob } from './tripDrafts'

export type DriverOutboxItem = {
  id: string
  clientMutationId: string
  type: 'assignment.shift' | 'trip.create' | 'trip.update' | 'location.batch'
  payload: Record<string, unknown>
  createdAt: string
  retryCount: number
}

const DB_NAME = 'taxi-fleet-driver'
const DB_VERSION = 2
const STORE = 'outbox'
const CACHE_STORE = 'cache'
const LIVE_STORE = 'liveTrips'
const RECEIPT_STORE = 'receiptBlobs'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(CACHE_STORE)) db.createObjectStore(CACHE_STORE, { keyPath: 'key' })
      if (!db.objectStoreNames.contains(LIVE_STORE)) db.createObjectStore(LIVE_STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(RECEIPT_STORE)) db.createObjectStore(RECEIPT_STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `m_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export async function enqueueDriverMutation(input: {
  type: DriverOutboxItem['type']
  payload: Record<string, unknown>
  clientMutationId?: string
}): Promise<DriverOutboxItem> {
  const db = await openDb()
  const item: DriverOutboxItem = {
    id: uuid(),
    clientMutationId: input.clientMutationId ?? uuid(),
    type: input.type,
    payload: input.payload,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(item)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
  return item
}

export async function getPendingOutboxCount(): Promise<number> {
  if (typeof indexedDB === 'undefined') return 0
  const db = await openDb()
  const count = await new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return count
}

async function listOutbox(): Promise<DriverOutboxItem[]> {
  const db = await openDb()
  const items = await new Promise<DriverOutboxItem[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result as DriverOutboxItem[])
    req.onerror = () => reject(req.error)
  })
  db.close()
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

async function removeOutboxItem(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function cacheDriverJson(key: string, value: unknown): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, 'readwrite')
    tx.objectStore(CACHE_STORE).put({ key, value, updatedAt: new Date().toISOString() })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function readCachedDriverJson<T>(key: string): Promise<T | null> {
  if (typeof indexedDB === 'undefined') return null
  const db = await openDb()
  const row = await new Promise<{ value: T } | undefined>((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, 'readonly')
    const req = tx.objectStore(CACHE_STORE).get(key)
    req.onsuccess = () => resolve(req.result as { value: T } | undefined)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return row?.value ?? null
}

export async function appendPendingTripToCache(trip: Record<string, unknown>): Promise<void> {
  const cached = await readCachedDriverJson<{ items?: Record<string, unknown>[] }>('driver/trips')
  const items = Array.isArray(cached?.items) ? [...cached.items] : []
  items.unshift({ ...trip, pending: true })
  await cacheDriverJson('driver/trips', { items })
}

function dataUrlToBlob(dataBase64: string, mime: string): Blob {
  const raw = dataBase64.includes(',') ? dataBase64.split(',')[1] ?? '' : dataBase64
  const binary = atob(raw)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

async function resolveReceiptAttachment(
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const blobId = typeof payload.receiptBlobId === 'string' ? payload.receiptBlobId : null
  if (!blobId) return payload
  const blobRow = await getReceiptBlob(blobId)
  if (!blobRow) {
    const { receiptBlobId: _drop, ...rest } = payload
    return rest
  }
  const form = new FormData()
  form.set('recordId', blobRow.draftRecordId)
  form.set('file', dataUrlToBlob(blobRow.dataBase64, blobRow.mime), blobRow.fileName)
  const res = await fetch('/api/taxi_fleet/driver/attachments', { method: 'POST', body: form })
  if (!res.ok) throw new Error(`receipt upload ${res.status}`)
  const json = (await res.json().catch(() => null)) as { id?: string } | null
  if (!json?.id) throw new Error('receipt upload missing id')
  await deleteReceiptBlob(blobId)
  const { receiptBlobId: _drop, ...rest } = payload
  return { ...rest, receiptAttachmentId: json.id }
}

export async function flushDriverOutbox(): Promise<void> {
  if (typeof indexedDB === 'undefined' || typeof fetch === 'undefined') return
  if (!navigator.onLine) return
  const items = await listOutbox()
  for (const item of items) {
    try {
      if (item.type === 'assignment.shift') {
        const assignmentId = String(item.payload.assignmentId ?? '')
        const res = await fetch(`/api/taxi_fleet/driver/assignments/${assignmentId}/shift`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: item.payload.action,
            clientMutationId: item.clientMutationId,
          }),
        })
        if (!res.ok) throw new Error(`shift ${res.status}`)
      } else if (item.type === 'trip.create') {
        const payload = await resolveReceiptAttachment(item.payload)
        const res = await fetch('/api/taxi_fleet/driver/trips', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...payload, clientMutationId: item.clientMutationId }),
        })
        if (!res.ok) throw new Error(`trip.create ${res.status}`)
      } else if (item.type === 'trip.update') {
        const payload = await resolveReceiptAttachment(item.payload)
        const res = await fetch('/api/taxi_fleet/driver/trips', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...payload, clientMutationId: item.clientMutationId }),
        })
        if (!res.ok) throw new Error(`trip.update ${res.status}`)
      } else if (item.type === 'location.batch') {
        const res = await fetch('/api/taxi_fleet/driver/location', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...item.payload, clientMutationId: item.clientMutationId }),
        })
        if (!res.ok) throw new Error(`location ${res.status}`)
      }
      await removeOutboxItem(item.id)
    } catch {
      break
    }
  }
}
