import type { EntityManager } from '@mikro-orm/postgresql'
import {
  buildMonthlySettlementDriverLink,
  notifyTaxiFleetPersonal,
} from '../lib/taxiFleetNotificationDelivery'
import { resolveTeamMemberUserId } from '../lib/resolveTeamMemberUserId'

export const metadata = {
  event: 'taxi_fleet.monthly_settlement.approved',
  persistent: true,
  id: 'taxi_fleet:monthly-settlement-ready-notification',
}

type MonthlySettlementApprovedPayload = {
  id: string
  tenantId: string
  organizationId: string
  teamMemberId: string
  monthStart?: string
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(payload: MonthlySettlementApprovedPayload, ctx: ResolverContext) {
  if (!payload.id || !payload.tenantId || !payload.organizationId || !payload.teamMemberId) return

  const em = ctx.resolve<EntityManager>('em')
  const recipientUserId = await resolveTeamMemberUserId(em, payload.teamMemberId, {
    tenantId: payload.tenantId,
    organizationId: payload.organizationId,
  })
  if (!recipientUserId) return

  const monthStart = payload.monthStart ?? ''
  await notifyTaxiFleetPersonal(ctx, {
    notificationType: 'taxi_fleet.monthly_settlement.ready',
    recipientUserId,
    tenantId: payload.tenantId,
    organizationId: payload.organizationId,
    titleVariables: { monthStart },
    bodyVariables: { monthStart },
    sourceEntityType: 'taxi_fleet:monthly_settlement',
    sourceEntityId: payload.id,
    linkHref: buildMonthlySettlementDriverLink(payload.id),
    logLabel: 'taxi_fleet:monthly-settlement-ready-notification',
  })
}
