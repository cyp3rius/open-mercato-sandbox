import type { EntityManager } from '@mikro-orm/postgresql'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import {
  buildTripLink,
  notifyTaxiFleetPersonal,
} from '../lib/taxiFleetNotificationDelivery'
import { resolveTeamMemberUserId } from '../lib/resolveTeamMemberUserId'

export const metadata = {
  event: 'taxi_fleet.trip.assigned',
  persistent: true,
  id: 'taxi_fleet:trip-assigned-notification',
}

type TripAssignedPayload = {
  id: string
  tenantId: string
  organizationId: string
  teamMemberId?: string | null
  requestId?: string | null
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(payload: TripAssignedPayload, ctx: ResolverContext) {
  if (!payload.id || !payload.tenantId || !payload.organizationId || !payload.teamMemberId) return

  const em = ctx.resolve<EntityManager>('em')
  const recipientUserId = await resolveTeamMemberUserId(em, payload.teamMemberId, {
    tenantId: payload.tenantId,
    organizationId: payload.organizationId,
  })
  if (!recipientUserId) return

  const { translate } = await resolveTranslations()
  const requestLabel = payload.requestId ?? payload.id

  await notifyTaxiFleetPersonal(ctx, {
    notificationType: 'taxi_fleet.trip.assigned',
    recipientUserId,
    tenantId: payload.tenantId,
    organizationId: payload.organizationId,
    titleVariables: { requestId: requestLabel },
    bodyVariables: {
      requestId: requestLabel,
      driverLabel: translate('taxi_fleet.notifications.variables.assigned_to_you', 'you'),
    },
    sourceEntityType: 'taxi_fleet:trip',
    sourceEntityId: payload.id,
    linkHref: buildTripLink(payload.id),
    logLabel: 'taxi_fleet:trip-assigned-notification',
  })
}
