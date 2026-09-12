import {
  buildTripLink,
  notifyTaxiFleetBroadcast,
} from '../lib/taxiFleetNotificationDelivery'

export const metadata = {
  event: 'taxi_fleet.trip.created',
  persistent: true,
  id: 'taxi_fleet:trip-created-notification',
}

type TripCreatedPayload = {
  id: string
  tenantId: string
  organizationId: string
  tripType?: string
  requestId?: string | null
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(payload: TripCreatedPayload, ctx: ResolverContext) {
  if (!payload.id || !payload.tenantId || !payload.organizationId) return

  await notifyTaxiFleetBroadcast(ctx, {
    notificationType: 'taxi_fleet.trip.order_created',
    tenantId: payload.tenantId,
    organizationId: payload.organizationId,
    titleVariables: {
      requestId: payload.requestId ?? payload.id,
    },
    bodyVariables: {
      requestId: payload.requestId ?? payload.id,
      tripType: payload.tripType ?? 'client',
    },
    sourceEntityType: 'taxi_fleet:trip',
    sourceEntityId: payload.id,
    linkHref: buildTripLink(payload.id),
    logLabel: 'taxi_fleet:trip-created-notification',
  })
}
