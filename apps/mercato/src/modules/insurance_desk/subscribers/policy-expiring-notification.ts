import {
  notifyFeatureUsersFromType,
  notifyPersonalFromType,
} from '@open-mercato/core/modules/notifications/lib/moduleNotificationDelivery'
import {
  INSURANCE_DESK_POLICY_EXPIRING_ALL_NOTIFY_FEATURE,
  notificationTypes,
} from '../notifications'

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

  const linkHref = `/backend/insurance-desk/policies/${encodeURIComponent(payload.policyId)}`
  const variables = buildVariables(payload)
  const groupKey = `${payload.policyId}:${payload.daysUntilExpiry}`
  const shared = {
    types: notificationTypes,
    tenantId: payload.tenantId,
    organizationId: payload.organizationId,
    titleVariables: variables,
    bodyVariables: variables,
    sourceEntityType: 'insurance:policy',
    sourceEntityId: payload.policyId,
    linkHref,
    groupKey,
  } as const

  await notifyFeatureUsersFromType(ctx, {
    ...shared,
    notificationType: 'insurance_desk.policy.expiring.all',
    requiredFeature: INSURANCE_DESK_POLICY_EXPIRING_ALL_NOTIFY_FEATURE,
    logLabel: 'insurance_desk:policy-expiring-notification:global',
  })

  const personalRecipients = new Set<string>()
  if (payload.caretakerUserId?.trim()) personalRecipients.add(payload.caretakerUserId.trim())
  if (payload.creatorUserId?.trim()) personalRecipients.add(payload.creatorUserId.trim())

  for (const recipientUserId of personalRecipients) {
    await notifyPersonalFromType(ctx, {
      ...shared,
      notificationType: 'insurance_desk.policy.expiring.my',
      recipientUserId,
      logLabel: 'insurance_desk:policy-expiring-notification:individual',
    })
  }
}
