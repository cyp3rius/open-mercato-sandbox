import type { EntityManager } from '@mikro-orm/postgresql'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { notifyPersonalFromType } from '../../notifications/lib/moduleNotificationDelivery'
import { notificationTypes } from '../notifications'
import { ServiceCase } from '../data/entities'

export const metadata = {
  event: 'cases.case.stage_owner_assigned',
  persistent: true,
  id: 'cases:case-stage-owner-assigned-notification',
}

type StageOwnerPayload = {
  caseId: string
  ownerUserId: string
  tenantId: string
  organizationId: string
  playbookId?: string | null
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(payload: StageOwnerPayload, ctx: ResolverContext) {
  if (!payload.caseId || !payload.tenantId || !payload.ownerUserId?.trim()) return

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
  await notifyPersonalFromType(ctx, {
    notificationType: 'cases.case.stage_owner_assigned',
    types: notificationTypes,
    recipientUserId: payload.ownerUserId.trim(),
    tenantId: payload.tenantId,
    organizationId: payload.organizationId ?? null,
    titleVariables: { title: caseRow.title },
    bodyVariables: { title: caseRow.title },
    sourceEntityType: 'cases:case',
    sourceEntityId: caseRow.id,
    linkHref,
    logLabel: 'cases:case-stage-owner-assigned-notification',
  })
}
