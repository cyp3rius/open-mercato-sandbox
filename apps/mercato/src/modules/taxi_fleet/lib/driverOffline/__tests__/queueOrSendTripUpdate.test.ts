/**
 * @jest-environment jsdom
 */
import { queueOrSendTripUpdate } from '../queueOrSendTripUpdate'

const enqueueDriverMutation = jest.fn()
const patchCachedTrip = jest.fn()
const apiCall = jest.fn()

jest.mock('../outbox', () => ({
  enqueueDriverMutation: (...args: unknown[]) => enqueueDriverMutation(...args),
}))

jest.mock('../driverDataCache', () => ({
  patchCachedTrip: (...args: unknown[]) => patchCachedTrip(...args),
}))

jest.mock('@open-mercato/ui/backend/utils/apiCall', () => ({
  apiCall: (...args: unknown[]) => apiCall(...args),
}))

describe('queueOrSendTripUpdate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  })

  it('enqueues when offline and patches cache', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    enqueueDriverMutation.mockResolvedValue({})
    patchCachedTrip.mockResolvedValue(undefined)

    const result = await queueOrSendTripUpdate(
      { id: 'trip-1', status: 'in_progress', startedAt: '2026-03-20T10:00:00.000Z' },
      { cachePatch: { status: 'in_progress' } },
    )

    expect(result.queued).toBe(true)
    expect(enqueueDriverMutation).toHaveBeenCalledWith({
      type: 'trip.update',
      payload: {
        id: 'trip-1',
        status: 'in_progress',
        startedAt: '2026-03-20T10:00:00.000Z',
      },
    })
    expect(patchCachedTrip).toHaveBeenCalledWith('trip-1', { status: 'in_progress' })
    expect(apiCall).not.toHaveBeenCalled()
  })

  it('enqueues when online request fails with network error', async () => {
    apiCall.mockRejectedValue(new TypeError('Failed to fetch'))
    enqueueDriverMutation.mockResolvedValue({})

    const result = await queueOrSendTripUpdate({ id: 'trip-1', status: 'completed' })

    expect(result.queued).toBe(true)
    expect(enqueueDriverMutation).toHaveBeenCalled()
  })

  it('enqueues on 503 responses', async () => {
    apiCall.mockResolvedValue({ ok: false, status: 503, result: null })
    enqueueDriverMutation.mockResolvedValue({})

    const result = await queueOrSendTripUpdate({ id: 'trip-1', status: 'completed' })

    expect(result.queued).toBe(true)
  })

  it('throws on business 4xx without enqueue', async () => {
    apiCall.mockResolvedValue({
      ok: false,
      status: 409,
      result: { error: 'Trip cannot be updated' },
    })

    await expect(
      queueOrSendTripUpdate({ id: 'trip-1', status: 'completed' }),
    ).rejects.toThrow(/Trip cannot be updated/)
    expect(enqueueDriverMutation).not.toHaveBeenCalled()
  })

  it('returns queued false on successful online update', async () => {
    apiCall.mockResolvedValue({ ok: true, status: 200, result: {} })
    patchCachedTrip.mockResolvedValue(undefined)

    const result = await queueOrSendTripUpdate(
      { id: 'trip-1', status: 'completed' },
      { cachePatch: { status: 'completed' } },
    )

    expect(result).toEqual({ queued: false })
    expect(enqueueDriverMutation).not.toHaveBeenCalled()
    expect(patchCachedTrip).toHaveBeenCalledWith('trip-1', { status: 'completed' })
  })
})
