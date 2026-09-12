import {
  buildTripLink,
  notifyTaxiFleetBroadcast,
} from '../lib/taxiFleetNotificationDelivery'

export const metadata = {
  event: 'taxi_fleet.trip.approved',
  persistent: true,
  id: 'taxi_fleet:trip-confirmed-notification',
}

type TripApprovedPayload = {
  id: string
  tenantId: string
  organizationId: string
  tripType?: string
  requestId?: string | null
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(payload: TripApprovedPayload, ctx: ResolverContext) {
  if (!payload.id || !payload.tenantId || !payload.organizationId) return

  const requestLabel = payload.requestId ?? payload.id

  await notifyTaxiFleetBroadcast(ctx, {
    notificationType: 'taxi_fleet.trip.confirmed',
    tenantId: payload.tenantId,
    organizationId: payload.organizationId,
    titleVariables: { requestId: requestLabel },
    bodyVariables: {
      requestId: requestLabel,
      tripType: payload.tripType ?? 'client',
    },
    sourceEntityType: 'taxi_fleet:trip',
    sourceEntityId: payload.id,
    linkHref: buildTripLink(payload.id),
    logLabel: 'taxi_fleet:trip-confirmed-notification',
  })
}
