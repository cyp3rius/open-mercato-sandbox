import type { EntityManager } from '@mikro-orm/postgresql'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { TaxiFleetTrip } from '../../data/entities'
import {
  buildDriverPushTag,
  buildDriverTripPushUrl,
  type DriverPushKind,
} from './pushPayload'
import { sendDriverPushIfAllowed } from './sendIfAllowed'

const REMINDER_LEAD_MS = 60 * 60 * 1000
const REMINDER_WINDOW_MS = 5 * 60 * 1000

export function reminderWindowFor(now: Date = new Date()): { from: Date; to: Date } {
  const target = now.getTime() + REMINDER_LEAD_MS
  return {
    from: new Date(target - REMINDER_WINDOW_MS),
    to: new Date(target + REMINDER_WINDOW_MS),
  }
}

async function buildPushCopy(
  kind: DriverPushKind,
  requestLabel: string,
): Promise<{ title: string; body: string }> {
  const { translate } = await resolveTranslations()
  if (kind === 'trip_reminder') {
    return {
      title: translate(
        'taxi_fleet.driverApp.push.reminderTitle',
        'Trip in 1 hour: {requestId}',
        { requestId: requestLabel },
      ),
      body: translate(
        'taxi_fleet.driverApp.push.reminderBody',
        'Your scheduled trip {requestId} starts in about one hour.',
        { requestId: requestLabel },
      ),
    }
  }
  return {
    title: translate(
      'taxi_fleet.driverApp.push.assignedTitle',
      'New scheduled trip: {requestId}',
      { requestId: requestLabel },
    ),
    body: translate(
      'taxi_fleet.driverApp.push.assignedBody',
      'A new trip was assigned to you. Tap to open details.',
      { requestId: requestLabel },
    ),
  }
}

function requestLabelFromTrip(trip: TaxiFleetTrip): string {
  const metadata = trip.metadata
  const tripRequest =
    metadata && typeof metadata === 'object' && metadata !== null && 'tripRequest' in metadata
      ? (metadata as { tripRequest?: { requestId?: unknown } }).tripRequest
      : undefined
  if (tripRequest && typeof tripRequest.requestId === 'string' && tripRequest.requestId.trim()) {
    return tripRequest.requestId.trim()
  }
  return trip.id
}

export async function sendDriverTripAssignedPush(
  em: EntityManager,
  params: {
    tripId: string
    tenantId: string
    organizationId: string
    teamMemberId: string
    requestId?: string | null
  },
): Promise<void> {
  const requestLabel = params.requestId?.trim() || params.tripId
  const copy = await buildPushCopy('trip_assigned', requestLabel)
  await sendDriverPushIfAllowed(em, {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    teamMemberId: params.teamMemberId,
    kind: 'trip_assigned',
    payload: {
      tripId: params.tripId,
      url: buildDriverTripPushUrl(params.tripId),
      title: copy.title,
      body: copy.body,
      tag: buildDriverPushTag('trip_assigned', params.tripId),
      urgency: 'high',
    },
  })
}

export async function processDriverTripRemindersForOrg(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
  now: Date = new Date(),
): Promise<{ scanned: number; sent: number }> {
  const { from, to } = reminderWindowFor(now)
  const trips = await em.find(TaxiFleetTrip, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    status: 'scheduled',
    teamMemberId: { $ne: null },
    startedAt: { $gte: from, $lte: to },
    driverReminderPushSentAt: null,
    deletedAt: null,
  })

  let sent = 0
  for (const trip of trips) {
    if (!trip.teamMemberId || !trip.startedAt) continue
    const requestLabel = requestLabelFromTrip(trip)
    const copy = await buildPushCopy('trip_reminder', requestLabel)
    const delivered = await sendDriverPushIfAllowed(em, {
      tenantId: trip.tenantId,
      organizationId: trip.organizationId,
      teamMemberId: trip.teamMemberId,
      kind: 'trip_reminder',
      payload: {
        tripId: trip.id,
        url: buildDriverTripPushUrl(trip.id),
        title: copy.title,
        body: copy.body,
        tag: buildDriverPushTag('trip_reminder', trip.id),
        urgency: 'high',
      },
    })
    trip.driverReminderPushSentAt = now
    trip.updatedAt = now
    em.persist(trip)
    if (delivered) sent += 1
  }
  if (trips.length) await em.flush()
  return { scanned: trips.length, sent }
}

export function clearDriverReminderPushIfStartedAtChanged(
  trip: TaxiFleetTrip,
  previousStartedAt: Date | null | undefined,
  nextStartedAt: Date | null | undefined,
): void {
  const prev = previousStartedAt?.getTime() ?? null
  const next = nextStartedAt?.getTime() ?? null
  if (prev === next) return
  trip.driverReminderPushSentAt = null
}
