import {
  buildTripLink,
  notifyTaxiFleetBroadcast,
} from '../lib/taxiFleetNotificationDelivery'

export const metadata = {
  event: 'taxi_fleet.trip.paid',
  persistent: true,
  id: 'taxi_fleet:trip-paid-notification',
}

type TripPaidPayload = {
  id: string
  tenantId: string
  organizationId: string
  paymentMethod?: string
  requestId?: string | null
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(payload: TripPaidPayload, ctx: ResolverContext) {
  if (!payload.id || !payload.tenantId || !payload.organizationId) return
  if (payload.paymentMethod && payload.paymentMethod !== 'paypal') return

  const requestLabel = payload.requestId ?? payload.id

  await notifyTaxiFleetBroadcast(ctx, {
    notificationType: 'taxi_fleet.trip.paid',
    tenantId: payload.tenantId,
    organizationId: payload.organizationId,
    titleVariables: { requestId: requestLabel },
    bodyVariables: {
      requestId: requestLabel,
      paymentMethod: payload.paymentMethod ?? 'paypal',
    },
    sourceEntityType: 'taxi_fleet:trip',
    sourceEntityId: payload.id,
    linkHref: buildTripLink(payload.id),
    logLabel: 'taxi_fleet:trip-paid-notification',
  })
}
