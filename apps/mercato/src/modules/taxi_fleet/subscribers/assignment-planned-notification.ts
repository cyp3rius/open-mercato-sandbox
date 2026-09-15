import type { EntityManager } from '@mikro-orm/postgresql'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { TaxiFleetDailyAssignment } from '../data/entities'
import { notifyTaxiFleetPersonal } from '../lib/taxiFleetNotificationDelivery'
import { resolveTeamMemberUserId } from '../lib/resolveTeamMemberUserId'
import {
  buildDriverAssignmentPushUrl,
  buildDriverPushTag,
} from '../lib/driverPush/pushPayload'
import { formatPushDateOnlyLabel } from '../lib/driverPush/pushCopyFormat'
import { sendDriverPushIfAllowed } from '../lib/driverPush/sendIfAllowed'

export const metadata = {
  event: 'taxi_fleet.assignment.created',
  persistent: true,
  id: 'taxi_fleet:assignment-planned-notification',
}

type AssignmentCreatedPayload = {
  id: string
  tenantId: string
  organizationId: string
  teamMemberId?: string | null
  assignmentDate?: string | null
  adHoc?: boolean
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(payload: AssignmentCreatedPayload, ctx: ResolverContext) {
  if (!payload.id || !payload.tenantId || !payload.organizationId) return
  if (payload.adHoc === true) return

  const em = ctx.resolve<EntityManager>('em')
  const assignment =
    payload.teamMemberId
      ? null
      : await em.findOne(TaxiFleetDailyAssignment, {
          id: payload.id,
          tenantId: payload.tenantId,
          organizationId: payload.organizationId,
          deletedAt: null,
        })

  const teamMemberId = payload.teamMemberId ?? assignment?.teamMemberId ?? null
  if (!teamMemberId) return

  const assignmentDate =
    payload.assignmentDate ??
    assignment?.assignmentDate ??
    ''

  const recipientUserId = await resolveTeamMemberUserId(em, teamMemberId, {
    tenantId: payload.tenantId,
    organizationId: payload.organizationId,
  })
  if (!recipientUserId) return

  await notifyTaxiFleetPersonal(ctx, {
    notificationType: 'taxi_fleet.assignment.planned',
    recipientUserId,
    tenantId: payload.tenantId,
    organizationId: payload.organizationId,
    titleVariables: { assignmentDate },
    bodyVariables: { assignmentDate },
    sourceEntityType: 'taxi_fleet:assignment',
    sourceEntityId: payload.id,
    linkHref: '/driver/assignments',
    logLabel: 'taxi_fleet:assignment-planned-notification',
  })

  try {
    const { translate, locale } = await resolveTranslations()
    const dateLabel = formatPushDateOnlyLabel(assignmentDate, locale)
    const title = translate(
      'taxi_fleet.driverApp.push.assignmentPlannedTitle',
      'New shift planned',
    )
    const body = dateLabel
      ? translate(
          'taxi_fleet.driverApp.push.assignmentPlannedBody',
          'A new work assignment was scheduled for you - {assignmentDate}',
          { assignmentDate: dateLabel },
        )
      : translate(
          'taxi_fleet.driverApp.push.assignmentPlannedBodyNoDate',
          'A new work assignment was scheduled for you.',
        )
    await sendDriverPushIfAllowed(em, {
      tenantId: payload.tenantId,
      organizationId: payload.organizationId,
      teamMemberId,
      kind: 'assignment_planned',
      payload: {
        url: buildDriverAssignmentPushUrl(),
        title,
        body,
        tag: buildDriverPushTag('assignment_planned', payload.id),
        urgency: 'normal',
      },
    })
  } catch (error) {
    console.error('[taxi_fleet:assignment-planned-notification] web push failed', error)
  }
}
