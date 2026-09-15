import type { EntityManager } from '@mikro-orm/postgresql'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import {
  buildSettlementLink,
  notifyTaxiFleetPersonal,
} from '../lib/taxiFleetNotificationDelivery'
import { resolveTeamMemberUserId } from '../lib/resolveTeamMemberUserId'
import {
  buildDriverPushTag,
  buildDriverSettlementPushUrl,
} from '../lib/driverPush/pushPayload'
import { sendDriverPushIfAllowed } from '../lib/driverPush/sendIfAllowed'

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

  const weekStart = payload.weekStart ?? ''
  await notifyTaxiFleetPersonal(ctx, {
    notificationType: 'taxi_fleet.settlement.ready',
    recipientUserId,
    tenantId: payload.tenantId,
    organizationId: payload.organizationId,
    titleVariables: { weekStart },
    bodyVariables: { weekStart },
    sourceEntityType: 'taxi_fleet:settlement',
    sourceEntityId: payload.id,
    linkHref: buildSettlementLink(payload.id),
    logLabel: 'taxi_fleet:settlement-ready-notification',
  })

  try {
    const { translate } = await resolveTranslations()
    const title = translate(
      'taxi_fleet.driverApp.push.settlementReadyTitle',
      'Weekly settlement ready: {weekStart}',
      { weekStart },
    )
    const body = translate(
      'taxi_fleet.driverApp.push.settlementReadyBody',
      'Your weekly settlement was approved. Tap to review.',
    )
    await sendDriverPushIfAllowed(em, {
      tenantId: payload.tenantId,
      organizationId: payload.organizationId,
      teamMemberId: payload.teamMemberId,
      kind: 'settlement_ready',
      payload: {
        url: buildDriverSettlementPushUrl(payload.id),
        title,
        body,
        tag: buildDriverPushTag('settlement_ready', payload.id),
        urgency: 'normal',
      },
    })
  } catch (error) {
    console.error('[taxi_fleet:settlement-ready-notification] web push failed', error)
  }
}
