import type { EntityManager } from '@mikro-orm/postgresql'
import {
  buildSettlementLink,
  notifyTaxiFleetPersonal,
} from '../lib/taxiFleetNotificationDelivery'
import { resolveTeamMemberUserId } from '../lib/resolveTeamMemberUserId'

export const metadata = {
  event: 'taxi_fleet.settlement.approved',
  persistent: true,
  id: 'taxi_fleet:settlement-ready-notification',
}

type SettlementApprovedPayload = {
  id: string
  tenantId: string
  organizationId: string
  teamMemberId: string
  weekStart?: string
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(payload: SettlementApprovedPayload, ctx: ResolverContext) {
  if (!payload.id || !payload.tenantId || !payload.organizationId || !payload.teamMemberId) return

  const em = ctx.resolve<EntityManager>('em')
  const recipientUserId = await resolveTeamMemberUserId(em, payload.teamMemberId, {
    tenantId: payload.tenantId,
    organizationId: payload.organizationId,
  })
  if (!recipientUserId) return

  await notifyTaxiFleetPersonal(ctx, {
    notificationType: 'taxi_fleet.settlement.ready',
    recipientUserId,
    tenantId: payload.tenantId,
    organizationId: payload.organizationId,
    titleVariables: { weekStart: payload.weekStart ?? '' },
    bodyVariables: { weekStart: payload.weekStart ?? '' },
    sourceEntityType: 'taxi_fleet:settlement',
    sourceEntityId: payload.id,
    linkHref: buildSettlementLink(payload.id),
    logLabel: 'taxi_fleet:settlement-ready-notification',
  })
}
