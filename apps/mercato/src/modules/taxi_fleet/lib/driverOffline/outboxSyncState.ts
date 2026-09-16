import type { DriverOutboxItem, DriverOutboxSyncStatus } from './outbox'

export type DriverEntitySyncState = DriverOutboxSyncStatus

function worseStatus(
  a: DriverEntitySyncState | null,
  b: DriverEntitySyncState | null,
): DriverEntitySyncState | null {
  if (a === 'failed' || b === 'failed') return 'failed'
  if (a === 'pending' || b === 'pending') return 'pending'
  return null
}

function itemMatchesTrip(item: DriverOutboxItem, tripId: string): boolean {
  if (item.type !== 'trip.create' && item.type !== 'trip.update') return false
  if (item.clientMutationId === tripId) return true
  const payloadId = item.payload.id
  if (typeof payloadId === 'string' && payloadId === tripId) return true
  const serverTripId = item.payload.serverTripId
  if (typeof serverTripId === 'string' && serverTripId === tripId) return true
  return false
}

function itemMatchesExpense(item: DriverOutboxItem, expenseId: string): boolean {
  if (item.type !== 'expense.create') return false
  if (item.clientMutationId === expenseId) return true
  const payloadId = item.payload.id
  return typeof payloadId === 'string' && payloadId === expenseId
}

function isShiftItem(item: DriverOutboxItem): boolean {
  return item.type === 'assignment.shift' || item.type === 'assignment.self_start'
}

/** Worst sync state among outbox rows matching a trip id (server or local pending id). */
export function resolveTripOutboxSyncState(
  items: DriverOutboxItem[],
  tripId: string,
): DriverEntitySyncState | null {
  let state: DriverEntitySyncState | null = null
  for (const item of items) {
    if (!itemMatchesTrip(item, tripId)) continue
    state = worseStatus(state, item.status === 'failed' ? 'failed' : 'pending')
  }
  return state
}

export function resolveExpenseOutboxSyncState(
  items: DriverOutboxItem[],
  expenseId: string,
): DriverEntitySyncState | null {
  let state: DriverEntitySyncState | null = null
  for (const item of items) {
    if (!itemMatchesExpense(item, expenseId)) continue
    state = worseStatus(state, item.status === 'failed' ? 'failed' : 'pending')
  }
  return state
}

export function resolveShiftOutboxSyncState(
  items: DriverOutboxItem[],
): DriverEntitySyncState | null {
  let state: DriverEntitySyncState | null = null
  for (const item of items) {
    if (!isShiftItem(item)) continue
    state = worseStatus(state, item.status === 'failed' ? 'failed' : 'pending')
  }
  return state
}

/** When listing from cache, `pending: true` means queued even before outbox lookup. */
export function resolveCachedPendingFlag(
  row: { pending?: unknown } | null | undefined,
  outboxState: DriverEntitySyncState | null,
): DriverEntitySyncState | null {
  if (outboxState) return outboxState
  if (row && row.pending === true) return 'pending'
  return null
}
