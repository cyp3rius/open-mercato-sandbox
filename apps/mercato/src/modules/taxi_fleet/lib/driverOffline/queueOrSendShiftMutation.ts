import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { enqueueDriverMutation } from './outbox'
import { isLikelyNetworkFailure } from './queueOrSendTripUpdate'
import {
  DRIVER_CACHE_KEYS,
  loadDriverFleetProfilesCache,
  loadDriverSnapshot,
  readLastDriverTeamMemberId,
  rememberDriverSnapshot,
  rememberLastDriverTeamMemberId,
  synthesizeMeFromFleetProfile,
} from './driverDataCache'

function rememberMeSnapshot(me: unknown): void {
  void rememberDriverSnapshot(DRIVER_CACHE_KEYS.me, me).catch(() => undefined)
  const memberId =
    me &&
    typeof me === 'object' &&
    'member' in me &&
    me.member &&
    typeof me.member === 'object' &&
    'id' in me.member &&
    typeof (me.member as { id?: unknown }).id === 'string'
      ? (me.member as { id: string }).id
      : null
  rememberLastDriverTeamMemberId(memberId)
}

async function loadMeFromFleetFallback<T>(): Promise<T | null> {
  const teamMemberId = readLastDriverTeamMemberId()
  if (!teamMemberId) return null
  const rows = await loadDriverFleetProfilesCache()
  const row = rows.find((item) => item.teamMemberId === teamMemberId)
  if (!row) return null
  return synthesizeMeFromFleetProfile(row) as T
}

export type QueueOrSendShiftResult = { queued: boolean }

/**
 * Clock-in / clock-out / ad-hoc start: send immediately or enqueue on offline / network fail.
 * Optionally persists an optimistic `driver/me` snapshot for the next offline open.
 */
export async function queueOrSendShiftMutation(params: {
  kind: 'planned' | 'ad_hoc'
  assignmentId?: string
  action?: 'start' | 'end'
  resourceId?: string | null
  optimisticMe?: unknown
}): Promise<QueueOrSendShiftResult> {
  const enqueue = async (): Promise<QueueOrSendShiftResult> => {
    if (params.kind === 'ad_hoc') {
      await enqueueDriverMutation({
        type: 'assignment.self_start',
        payload: { resourceId: params.resourceId },
      })
    } else {
      await enqueueDriverMutation({
        type: 'assignment.shift',
        payload: {
          assignmentId: params.assignmentId,
          action: params.action,
          ...(params.resourceId ? { resourceId: params.resourceId } : {}),
        },
      })
    }
    if (params.optimisticMe) {
      rememberMeSnapshot(params.optimisticMe)
    }
    return { queued: true }
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return enqueue()
  }

  try {
    const call =
      params.kind === 'ad_hoc'
        ? await apiCall('/api/taxi_fleet/driver/assignments/start', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ resourceId: params.resourceId }),
          })
        : await apiCall(`/api/taxi_fleet/driver/assignments/${params.assignmentId}/shift`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              action: params.action,
              ...(params.resourceId ? { resourceId: params.resourceId } : {}),
            }),
          })
    if (call.ok) {
      if (params.optimisticMe) {
        rememberMeSnapshot(params.optimisticMe)
      }
      return { queued: false }
    }
    if (isLikelyNetworkFailure(null, call.status)) {
      return enqueue()
    }
    const body = call.result as { error?: string } | null
    throw new Error(body?.error || `Shift update failed (${call.status})`)
  } catch (error) {
    if (isLikelyNetworkFailure(error)) {
      return enqueue()
    }
    throw error
  }
}

export async function loadDriverMeWithCache<T>(): Promise<{
  me: T | null
  fromCache: boolean
}> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const cached = await loadDriverSnapshot<T>(DRIVER_CACHE_KEYS.me)
    if (cached) return { me: cached, fromCache: true }
    const fromFleet = await loadMeFromFleetFallback<T>()
    return { me: fromFleet, fromCache: Boolean(fromFleet) }
  }
  try {
    const call = await apiCall<T>('/api/taxi_fleet/driver/me')
    if (call.ok && call.result) {
      rememberMeSnapshot(call.result)
      return { me: call.result, fromCache: false }
    }
  } catch {
    // fall through
  }
  const cached = await loadDriverSnapshot<T>(DRIVER_CACHE_KEYS.me)
  if (cached) return { me: cached, fromCache: true }
  const fromFleet = await loadMeFromFleetFallback<T>()
  return { me: fromFleet, fromCache: Boolean(fromFleet) }
}
