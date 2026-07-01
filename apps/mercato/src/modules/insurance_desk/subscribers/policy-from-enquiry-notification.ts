import type { EntityManager } from '@mikro-orm/postgresql'
import { InsuranceLead } from '@open-mercato/core/modules/insurance/data/entities'
import { resolveNotificationService } from '@open-mercato/core/modules/notifications/lib/notificationService'
import { buildFeatureNotificationFromType } from '@open-mercato/core/modules/notifications/lib/notificationBuilder'
import { INSURANCE_DESK_POLICY_FROM_ENQUIRY_NOTIFY_FEATURE, notificationTypes } from '../notifications'

export const metadata = {
  event: 'insurance.policy.created_from_lead',
  persistent: true,
  id: 'insurance_desk:policy-from-enquiry-notification',
}

type PolicyFromLeadPayload = {
  policyId: string
  policyNumber: string
  sourceLeadId: string
  tenantId: string
  organizationId: string
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(payload: PolicyFromLeadPayload, ctx: ResolverContext) {
  if (!payload.policyId || !payload.sourceLeadId || !payload.tenantId) return

  try {
    const em = ctx.resolve<EntityManager>('em')
    const lead = await em.findOne(InsuranceLead, {
      id: payload.sourceLeadId,
      deletedAt: null,
    })
    const leadTitle = lead?.title?.trim() || payload.sourceLeadId

    const typeDef = notificationTypes.find((type) => type.type === 'insurance_desk.policy.from_enquiry')
    if (!typeDef) return

    const notificationService = resolveNotificationService(ctx)
    const linkHref = `/backend/insurance-desk/policies/${encodeURIComponent(payload.policyId)}`
    const notificationInput = buildFeatureNotificationFromType(typeDef, {
      requiredFeature: INSURANCE_DESK_POLICY_FROM_ENQUIRY_NOTIFY_FEATURE,
      titleVariables: {
        policyNumber: payload.policyNumber,
        leadTitle,
      },
      bodyVariables: {
        policyNumber: payload.policyNumber,
        leadTitle,
      },
      sourceEntityType: 'insurance:policy',
      sourceEntityId: payload.policyId,
      linkHref,
    })

    await notificationService.createForNotificationType(notificationInput, {
      tenantId: payload.tenantId,
      organizationId: payload.organizationId,
    })
  } catch (err) {
    console.error('[insurance_desk:policy-from-enquiry-notification] Failed to create notification:', err)
  }
}
