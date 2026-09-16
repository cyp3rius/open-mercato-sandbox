import type { DriverOutboxItem } from '../outbox'
import {
  resolveCachedPendingFlag,
  resolveExpenseOutboxSyncState,
  resolveShiftOutboxSyncState,
  resolveTripOutboxSyncState,
} from '../outboxSyncState'

function item(
  partial: Partial<DriverOutboxItem> & Pick<DriverOutboxItem, 'type' | 'payload'>,
): DriverOutboxItem {
  return {
    id: partial.id ?? 'out-1',
    clientMutationId: partial.clientMutationId ?? 'cm-1',
    type: partial.type,
    payload: partial.payload,
    createdAt: partial.createdAt ?? '2026-03-20T10:00:00.000Z',
    retryCount: partial.retryCount ?? 0,
    status: partial.status ?? 'pending',
    lastError: partial.lastError ?? null,
    failedAt: partial.failedAt ?? null,
  }
}

describe('outboxSyncState', () => {
  it('resolves trip sync by payload id and clientMutationId', () => {
    const items = [
      item({
        type: 'trip.update',
        payload: { id: 'trip-1', status: 'in_progress' },
        status: 'pending',
      }),
      item({
        id: 'out-2',
        clientMutationId: 'local-trip',
        type: 'trip.create',
        payload: {},
        status: 'failed',
      }),
    ]
    expect(resolveTripOutboxSyncState(items, 'trip-1')).toBe('pending')
    expect(resolveTripOutboxSyncState(items, 'local-trip')).toBe('failed')
    expect(resolveTripOutboxSyncState(items, 'other')).toBeNull()
  })

  it('prefers failed over pending for the same entity', () => {
    const items = [
      item({
        type: 'trip.update',
        payload: { id: 'trip-1' },
        status: 'pending',
      }),
      item({
        id: 'out-2',
        type: 'trip.update',
        payload: { id: 'trip-1' },
        status: 'failed',
      }),
    ]
    expect(resolveTripOutboxSyncState(items, 'trip-1')).toBe('failed')
  })

  it('resolves expense and shift states', () => {
    expect(
      resolveExpenseOutboxSyncState(
        [
          item({
            clientMutationId: 'exp-1',
            type: 'expense.create',
            payload: {},
            status: 'pending',
          }),
        ],
        'exp-1',
      ),
    ).toBe('pending')
    expect(
      resolveShiftOutboxSyncState([
        item({ type: 'assignment.self_start', payload: { resourceId: 'v1' }, status: 'failed' }),
      ]),
    ).toBe('failed')
  })

  it('falls back to cached pending flag', () => {
    expect(resolveCachedPendingFlag({ pending: true }, null)).toBe('pending')
    expect(resolveCachedPendingFlag({ pending: true }, 'failed')).toBe('failed')
    expect(resolveCachedPendingFlag({}, null)).toBeNull()
  })
})
