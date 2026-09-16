import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { enqueueDriverMutation } from './outbox'
import { patchCachedTrip } from './driverDataCache'

export type QueueOrSendTripUpdateResult = {
  queued: boolean
}

export function isLikelyNetworkFailure(error: unknown, status?: number): boolean {
  if (typeof status === 'number' && status >= 500) return true
  if (typeof status === 'number' && status === 0) return true
  if (!error) return false
  if (typeof error === 'object' && error !== null) {
    const name = 'name' in error ? String((error as { name?: unknown }).name ?? '') : ''
    const message =
      'message' in error ? String((error as { message?: unknown }).message ?? '') : ''
    if (name === 'TypeError' || name === 'NetworkError' || name === 'AbortError') return true
    if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
      return true
    }
  }
  return false
}

/**
 * Sends a trip update immediately when online, otherwise (or on network/5xx failure)
 * enqueues it for flushDriverOutbox. Optionally patches the local trips cache.
 */
export async function queueOrSendTripUpdate(
  payload: Record<string, unknown>,
  options?: {
    cachePatch?: Record<string, unknown>
  },
): Promise<QueueOrSendTripUpdateResult> {
  const tripId = typeof payload.id === 'string' ? payload.id : null
  const applyCache = async () => {
    if (!tripId || !options?.cachePatch) return
    await patchCachedTrip(tripId, options.cachePatch)
  }

  const enqueue = async (): Promise<QueueOrSendTripUpdateResult> => {
    await enqueueDriverMutation({ type: 'trip.update', payload })
    await applyCache()
    return { queued: true }
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return enqueue()
  }

  try {
    const call = await apiCall('/api/taxi_fleet/driver/trips', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (call.ok) {
      await applyCache()
      return { queued: false }
    }
    if (isLikelyNetworkFailure(null, call.status)) {
      return enqueue()
    }
    const body = call.result as { error?: string } | null
    const error = new Error(body?.error || `Trip update failed (${call.status})`) as Error & {
      status?: number
      body?: { error?: string }
    }
    error.status = call.status
    error.body = body ?? undefined
    throw error
  } catch (error) {
    if (isLikelyNetworkFailure(error)) {
      return enqueue()
    }
    throw error
  }
}
