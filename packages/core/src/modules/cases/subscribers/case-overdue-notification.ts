import type { EntityManager } from '@mikro-orm/postgresql'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { resolveNotificationService } from '../../notifications/lib/notificationService'
import { buildNotificationFromType } from '../../notifications/lib/notificationBuilder'
import { notificationTypes } from '../notifications'
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

    const recipientUserId = payload.ownerUserId?.trim() || caseRow.ownerUserId?.trim() || ''
    if (!recipientUserId.length) return

    const typeDef = notificationTypes.find((type) => type.type === 'cases.case.overdue')
    if (!typeDef) return

    const notificationService = resolveNotificationService(ctx)
    const linkHref = `/backend/cases/${encodeURIComponent(caseRow.id)}`
    const notificationInput = buildNotificationFromType(typeDef, {
      recipientUserId,
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
    console.error('[cases:case-overdue-notification] Failed to create notification:', err)
  }
}
