import type { EntityManager } from '@mikro-orm/postgresql'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { resolveNotificationService } from '../../notifications/lib/notificationService'
import { buildNotificationFromType } from '../../notifications/lib/notificationBuilder'
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

  try {
    const em = ctx.resolve<EntityManager>('em')
    const caseRow = await findOneWithDecryption(
      em,
      ServiceCase,
      { id: payload.caseId, deletedAt: null },
      undefined,
      { tenantId: payload.tenantId, organizationId: payload.organizationId ?? null },
    )
    if (!caseRow) return

    const typeDef = notificationTypes.find((type) => type.type === 'cases.case.stage_owner_assigned')
    if (!typeDef) return

    const notificationService = resolveNotificationService(ctx)
    const linkHref = `/backend/cases/${encodeURIComponent(caseRow.id)}`
    const notificationInput = buildNotificationFromType(typeDef, {
      recipientUserId: payload.ownerUserId.trim(),
      titleVariables: { title: caseRow.title },
      bodyVariables: { title: caseRow.title },
      sourceEntityType: 'cases:case',
      sourceEntityId: caseRow.id,
      linkHref,
    })

    await notificationService.create(notificationInput, {
      tenantId: payload.tenantId,
      organizationId: payload.organizationId ?? null,
    })
  } catch (err) {
    console.error('[cases:case-stage-owner-assigned-notification] Failed to create notification:', err)
  }
}
