import type { EntityManager } from '@mikro-orm/postgresql'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import {
  notifyFeatureUsersFromType,
  notifyPersonalFromType,
} from '../../notifications/lib/moduleNotificationDelivery'
import {
  CASES_CASE_OVERDUE_NOTIFY_FEATURE,
  notificationTypes,
} from '../notifications'
import { ServiceCase } from '../data/entities'

export const metadata = {
  event: 'cases.case.overdue',
  persistent: true,
  id: 'cases:case-overdue-notification',
}

type CaseOverduePayload = {
  caseId: string
  ownerUserId?: string | null
  tenantId: string
  organizationId: string
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(payload: CaseOverduePayload, ctx: ResolverContext) {
  if (!payload.caseId || !payload.tenantId) return

  const em = ctx.resolve<EntityManager>('em')
  const caseRow = await findOneWithDecryption(
    em,
    ServiceCase,
    { id: payload.caseId, deletedAt: null },
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
    notificationType: 'cases.case.overdue',
    requiredFeature: CASES_CASE_OVERDUE_NOTIFY_FEATURE,
    logLabel: 'cases:case-overdue-notification:global',
  })

  const ownerUserId = payload.ownerUserId?.trim() || caseRow.ownerUserId?.trim() || ''
  if (!ownerUserId) return

  await notifyPersonalFromType(ctx, {
    ...shared,
    notificationType: 'cases.case.overdue.owner',
    recipientUserId: ownerUserId,
    logLabel: 'cases:case-overdue-notification:owner',
  })
}
