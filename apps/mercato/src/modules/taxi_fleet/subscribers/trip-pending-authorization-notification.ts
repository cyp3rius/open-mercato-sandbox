import {
  buildTripLink,
  notifyTaxiFleetBroadcast,
} from '../lib/taxiFleetNotificationDelivery'

export const metadata = {
  event: 'taxi_fleet.trip.pending_authorization',
  persistent: true,
  id: 'taxi_fleet:trip-pending-authorization-notification',
}

type TripPendingAuthorizationPayload = {
  id: string
  tenantId: string
  organizationId: string
  tripType?: string
  teamMemberId?: string | null
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(payload: TripPendingAuthorizationPayload, ctx: ResolverContext) {
  if (!payload.id || !payload.tenantId || !payload.organizationId) return
  if (payload.tripType && payload.tripType !== 'internal') return

  await notifyTaxiFleetBroadcast(ctx, {
    notificationType: 'taxi_fleet.trip.pending_authorization',
    tenantId: payload.tenantId,
    organizationId: payload.organizationId,
    bodyVariables: {
      tripType: payload.tripType ?? 'internal',
    },
    sourceEntityType: 'taxi_fleet:trip',
    sourceEntityId: payload.id,
    linkHref: buildTripLink(payload.id),
    groupKey: `taxi_fleet:trip.pending_authorization:${payload.id}`,
    logLabel: 'taxi_fleet:trip-pending-authorization-notification',
  })
}
