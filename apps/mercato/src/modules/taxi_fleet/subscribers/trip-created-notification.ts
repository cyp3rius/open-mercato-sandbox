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
  ingestSource?: string | null
  fromAddress?: string | null
  toAddress?: string | null
  paymentType?: string | null
  contactName?: string | null
  contactPhone?: string | null
  contactEmail?: string | null
  revenueAmount?: string | null
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

function routeSummary(payload: TripCreatedPayload): string {
  const from = payload.fromAddress?.trim() || ''
  const to = payload.toAddress?.trim() || ''
  if (from && to) return `${from} → ${to}`
  return from || to || '—'
}

export default async function handle(payload: TripCreatedPayload, ctx: ResolverContext) {
  if (!payload.id || !payload.tenantId || !payload.organizationId) return
  // Platform CSV imports must not create order notifications.
  if (payload.ingestSource === 'platform_csv') return

  const requestId = payload.requestId ?? payload.id

  await notifyTaxiFleetBroadcast(ctx, {
    notificationType: 'taxi_fleet.trip.order_created',
    tenantId: payload.tenantId,
    organizationId: payload.organizationId,
    titleVariables: {
      requestId,
    },
    bodyVariables: {
      requestId,
      tripType: payload.tripType ?? 'client',
      route: routeSummary(payload),
      paymentType: payload.paymentType?.trim() || '—',
      contactName: payload.contactName?.trim() || '—',
      contactPhone: payload.contactPhone?.trim() || '—',
      contactEmail: payload.contactEmail?.trim() || '—',
      revenueAmount: payload.revenueAmount?.trim() || '—',
    },
    sourceEntityType: 'taxi_fleet:trip',
    sourceEntityId: payload.id,
    linkHref: buildTripLink(payload.id),
    logLabel: 'taxi_fleet:trip-created-notification',
  })
}
