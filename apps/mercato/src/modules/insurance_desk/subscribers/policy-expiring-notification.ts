import { resolveNotificationService } from '@open-mercato/core/modules/notifications/lib/notificationService'
import { buildNotificationFromType } from '@open-mercato/core/modules/notifications/lib/notificationBuilder'
import { resolveRecipientsForNotificationType, shouldDeliverNotification } from '@open-mercato/core/modules/notifications/lib/notificationPreferenceService'
import type { EntityManager } from '@mikro-orm/postgresql'
import { notificationTypes } from '../notifications'

export const metadata = {
  event: 'insurance.policy.expiring',
  persistent: true,
  id: 'insurance_desk:policy-expiring-notification',
}

type PolicyExpiringPayload = {
  policyId: string
  policyNumber: string
  validTo: string
  daysUntilExpiry: number
  caretakerUserId: string | null
  creatorUserId: string | null
  tenantId: string
  organizationId: string
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

const MY_TYPE = 'insurance_desk.policy.expiring.my'
const ALL_TYPE = 'insurance_desk.policy.expiring.all'

function formatValidTo(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toISOString().slice(0, 10)
}

function buildVariables(payload: PolicyExpiringPayload) {
  return {
    policyNumber: payload.policyNumber,
    daysUntilExpiry: String(payload.daysUntilExpiry),
    validTo: formatValidTo(payload.validTo),
  }
}

export default async function handle(payload: PolicyExpiringPayload, ctx: ResolverContext) {
  if (!payload.policyId || !payload.tenantId || !payload.organizationId) return

  try {
    const em = ctx.resolve<EntityManager>('em')
    const notificationService = resolveNotificationService(ctx)
    const myTypeDef = notificationTypes.find((type) => type.type === MY_TYPE)
    const allTypeDef = notificationTypes.find((type) => type.type === ALL_TYPE)
    if (!myTypeDef || !allTypeDef) return

    const linkHref = `/backend/insurance-desk/policies/${encodeURIComponent(payload.policyId)}`
    const variables = buildVariables(payload)
    const groupKey = `${payload.policyId}:${payload.daysUntilExpiry}`
    const deliveryContext = {
      tenantId: payload.tenantId,
      organizationId: payload.organizationId,
    }

    const personalRecipients = new Set<string>()
    if (payload.caretakerUserId?.trim()) personalRecipients.add(payload.caretakerUserId.trim())
    if (payload.creatorUserId?.trim()) personalRecipients.add(payload.creatorUserId.trim())

    const notifiedUserIds = new Set<string>()

    for (const recipientUserId of personalRecipients) {
      const canDeliver = await shouldDeliverNotification(em, recipientUserId, payload.tenantId, MY_TYPE)
      if (!canDeliver) continue

      const notificationInput = buildNotificationFromType(myTypeDef, {
        recipientUserId,
        titleVariables: variables,
        bodyVariables: variables,
        sourceEntityType: 'insurance:policy',
        sourceEntityId: payload.policyId,
        linkHref,
        groupKey,
      })

      await notificationService.create(notificationInput, deliveryContext)
      notifiedUserIds.add(recipientUserId)
    }

    const roleRecipients = await resolveRecipientsForNotificationType(em, payload.tenantId, ALL_TYPE)
    for (const recipientUserId of roleRecipients) {
      if (notifiedUserIds.has(recipientUserId)) continue

      const notificationInput = buildNotificationFromType(allTypeDef, {
        recipientUserId,
        titleVariables: variables,
        bodyVariables: variables,
        sourceEntityType: 'insurance:policy',
        sourceEntityId: payload.policyId,
        linkHref,
        groupKey,
      })

      await notificationService.create(notificationInput, deliveryContext)
    }
  } catch (err) {
    console.error('[insurance_desk:policy-expiring-notification] Failed to create notification:', err)
  }
}
