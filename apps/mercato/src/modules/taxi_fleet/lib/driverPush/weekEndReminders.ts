import type { EntityManager } from '@mikro-orm/postgresql'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { TaxiFleetPushSubscription } from '../../data/entities'
import { normalizeDateOnly } from '../weekUtils'
import { buildDriverPushTag } from './pushPayload'
import { sendDriverPushIfAllowed } from './sendIfAllowed'

/**
 * Sunday reminder: upload receipts/costs before the settlement week closes.
 * Targets drivers with an active push subscription (app users). No deep link.
 */
export async function processWeekEndRemindersForOrg(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
  now: Date = new Date(),
): Promise<{ recipients: number; sent: number }> {
  const subscriptions = await em.find(
    TaxiFleetPushSubscription,
    {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    },
    { fields: ['teamMemberId'] },
  )

  const teamMemberIds = [...new Set(subscriptions.map((row) => row.teamMemberId).filter(Boolean))]
  if (teamMemberIds.length === 0) return { recipients: 0, sent: 0 }

  const { translate } = await resolveTranslations()
  const title = translate(
    'taxi_fleet.driverApp.push.weekEndReminderTitle',
    'The week is ending soon',
  )
  const body = translate(
    'taxi_fleet.driverApp.push.weekEndReminderBody',
    'The settlement week ends today. Remember to upload all receipts and costs.',
  )
  const dayKey = normalizeDateOnly(now) || now.toISOString().slice(0, 10)
  const tag = buildDriverPushTag('week_end_reminder', dayKey)

  let sent = 0
  for (const teamMemberId of teamMemberIds) {
    const delivered = await sendDriverPushIfAllowed(em, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      teamMemberId,
      kind: 'week_end_reminder',
      payload: {
        title,
        body,
        tag,
        urgency: 'normal',
      },
    })
    if (delivered) sent += 1
  }

  return { recipients: teamMemberIds.length, sent }
}
