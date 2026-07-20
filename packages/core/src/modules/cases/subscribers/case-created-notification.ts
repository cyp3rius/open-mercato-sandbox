import type { EntityManager } from '@mikro-orm/postgresql'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import {
  notifyFeatureUsersFromType,
  notifyPersonalFromType,
} from '../../notifications/lib/moduleNotificationDelivery'
import {
  CASES_CASE_CREATE_NOTIFY_FEATURE,
  notificationTypes,
} from '../notifications'
import { ServiceCase } from '../data/entities'

export const metadata = {
  event: 'cases.case.created',
  persistent: true,
  id: 'cases:case-created-notification',
}

type CaseCreatedPayload = {
  id: string
  tenantId: string
  organizationId: string
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(payload: CaseCreatedPayload, ctx: ResolverContext) {
  if (!payload.id || !payload.tenantId) return

  const em = ctx.resolve<EntityManager>('em')
  const caseRow = await findOneWithDecryption(
    em,
    ServiceCase,
    { id: payload.id, deletedAt: null },
    undefined,
    { tenantId: payload.tenantId, organizationId: payload.organizationId ?? null },
  )
  if (!caseRow) return

  const linkHref = `/backend/cases/${encodeURIComponent(caseRow.id)}`
  const shared = {
    types: notificationTypes,
    tenantId: payload.tenantId,
    organizationId: payload.organizationId ?? null,
    titleVariables: { title: caseRow.title },
    bodyVariables: { title: caseRow.title },
    sourceEntityType: 'cases:case',
    sourceEntityId: caseRow.id,
    linkHref,
  } as const

  await notifyFeatureUsersFromType(ctx, {
    ...shared,
    notificationType: 'cases.case.created',
    requiredFeature: CASES_CASE_CREATE_NOTIFY_FEATURE,
    logLabel: 'cases:case-created-notification:global',
  })

  const ownerUserId = caseRow.ownerUserId?.trim()
  if (!ownerUserId) return

  await notifyPersonalFromType(ctx, {
    ...shared,
    notificationType: 'cases.case.created.owner',
    recipientUserId: ownerUserId,
    logLabel: 'cases:case-created-notification:owner',
  })
}
