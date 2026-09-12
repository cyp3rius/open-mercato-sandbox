import {
  buildTripLink,
  notifyTaxiFleetBroadcast,
} from '../lib/taxiFleetNotificationDelivery'

export const metadata = {
  event: 'taxi_fleet.trip.submitted',
  persistent: true,
  id: 'taxi_fleet:trip-submitted-notification',
}

type TripSubmittedPayload = {
  id: string
  tenantId: string
  organizationId: string
  tripType?: string
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(payload: TripSubmittedPayload, ctx: ResolverContext) {
  if (!payload.id || !payload.tenantId) return

  await notifyTaxiFleetBroadcast(ctx, {
    notificationType: 'taxi_fleet.trip.submitted',
    tenantId: payload.tenantId,
    organizationId: payload.organizationId,
    bodyVariables: { tripType: payload.tripType ?? 'other' },
    sourceEntityType: 'taxi_fleet:trip',
    sourceEntityId: payload.id,
    linkHref: buildTripLink(payload.id),
    logLabel: 'taxi_fleet:trip-submitted-notification',
  })
}
