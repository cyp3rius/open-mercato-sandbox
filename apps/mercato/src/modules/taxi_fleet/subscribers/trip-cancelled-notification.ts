import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import {
  buildTripLink,
  notifyTaxiFleetBroadcast,
} from '../lib/taxiFleetNotificationDelivery'

export const metadata = {
  event: 'taxi_fleet.trip.cancelled',
  persistent: true,
  id: 'taxi_fleet:trip-cancelled-notification',
}

type TripCancelledPayload = {
  id: string
  tenantId: string
  organizationId: string
  cancelSource?: string
  cancelReason?: string | null
  requestId?: string | null
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

function resolveCancelSourceLabel(
  translate: (key: string, fallback?: string) => string,
  cancelSource?: string,
): string {
  switch (cancelSource) {
    case 'customer':
      return translate('taxi_fleet.notifications.cancel_source.customer', 'customer')
    case 'operator':
      return translate('taxi_fleet.notifications.cancel_source.operator', 'operator')
    case 'driver':
      return translate('taxi_fleet.notifications.cancel_source.driver', 'driver')
    default:
      return cancelSource?.trim() || translate('taxi_fleet.notifications.cancel_source.unknown', 'unknown')
  }
}

export default async function handle(payload: TripCancelledPayload, ctx: ResolverContext) {
  if (!payload.id || !payload.tenantId || !payload.organizationId) return

  const { translate } = await resolveTranslations()
  const requestLabel = payload.requestId ?? payload.id
  const cancelSourceLabel = resolveCancelSourceLabel(translate, payload.cancelSource)

  await notifyTaxiFleetBroadcast(ctx, {
    notificationType: 'taxi_fleet.trip.cancelled',
    tenantId: payload.tenantId,
    organizationId: payload.organizationId,
    titleVariables: { requestId: requestLabel },
    bodyVariables: {
      requestId: requestLabel,
      cancelSource: cancelSourceLabel,
      cancelReason: payload.cancelReason?.trim() || translate('taxi_fleet.notifications.variables.no_reason', '—'),
    },
    sourceEntityType: 'taxi_fleet:trip',
    sourceEntityId: payload.id,
    linkHref: buildTripLink(payload.id),
    logLabel: 'taxi_fleet:trip-cancelled-notification',
  })
}
