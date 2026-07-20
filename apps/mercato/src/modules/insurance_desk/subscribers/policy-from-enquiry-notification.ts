import type { EntityManager } from '@mikro-orm/postgresql'
import { InsuranceLead } from '@open-mercato/core/modules/insurance/data/entities'
import { notifyFeatureUsersFromType } from '@open-mercato/core/modules/notifications/lib/moduleNotificationDelivery'
import {
  INSURANCE_DESK_POLICY_FROM_ENQUIRY_NOTIFY_FEATURE,
  notificationTypes,
} from '../notifications'

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

  const em = ctx.resolve<EntityManager>('em')
  const lead = await em.findOne(InsuranceLead, {
    id: payload.sourceLeadId,
    deletedAt: null,
  })
  const leadTitle = lead?.title?.trim() || payload.sourceLeadId
  const linkHref = `/backend/insurance-desk/policies/${encodeURIComponent(payload.policyId)}`

  await notifyFeatureUsersFromType(ctx, {
    notificationType: 'insurance_desk.policy.from_enquiry',
    types: notificationTypes,
    requiredFeature: INSURANCE_DESK_POLICY_FROM_ENQUIRY_NOTIFY_FEATURE,
    tenantId: payload.tenantId,
    organizationId: payload.organizationId,
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
    logLabel: 'insurance_desk:policy-from-enquiry-notification',
  })
}
