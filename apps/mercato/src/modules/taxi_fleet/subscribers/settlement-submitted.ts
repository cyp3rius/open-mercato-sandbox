import { notifyTaxiFleetBroadcast } from '../lib/taxiFleetNotificationDelivery'

export const metadata = {
  event: 'taxi_fleet.settlement.submitted',
  persistent: true,
  id: 'taxi_fleet:settlement-submitted-notification',
}

type SettlementSubmittedPayload = {
  id: string
  tenantId: string
  organizationId: string
  weekStart?: string
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(payload: SettlementSubmittedPayload, ctx: ResolverContext) {
  if (!payload.id || !payload.tenantId) return

  await notifyTaxiFleetBroadcast(ctx, {
    notificationType: 'taxi_fleet.settlement.submitted',
    tenantId: payload.tenantId,
    organizationId: payload.organizationId,
    bodyVariables: { weekStart: payload.weekStart ?? '' },
    sourceEntityType: 'taxi_fleet:settlement',
    sourceEntityId: payload.id,
    linkHref: '/backend/taxi-fleet/settlements',
    logLabel: 'taxi_fleet:settlement-submitted-notification',
  })
}
