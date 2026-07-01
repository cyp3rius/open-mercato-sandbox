import type { EntityManager } from '@mikro-orm/postgresql'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { resolveNotificationService } from '../../notifications/lib/notificationService'
import { buildFeatureNotificationFromType } from '../../notifications/lib/notificationBuilder'
import { notificationTypes } from '../notifications'
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

  try {
    const em = ctx.resolve<EntityManager>('em')
    const caseRow = await findOneWithDecryption(
      em,
      ServiceCase,
      { id: payload.id, deletedAt: null },
      undefined,
      { tenantId: payload.tenantId, organizationId: payload.organizationId ?? null },
    )
    if (!caseRow) return

    const typeDef = notificationTypes.find((type) => type.type === 'cases.case.created')
    if (!typeDef) return

    const notificationService = resolveNotificationService(ctx)
    const linkHref = `/backend/cases/${encodeURIComponent(caseRow.id)}`
    const notificationInput = buildFeatureNotificationFromType(typeDef, {
      requiredFeature: 'cases.view',
      titleVariables: { title: caseRow.title },
      bodyVariables: { title: caseRow.title },
      sourceEntityType: 'cases:case',
      sourceEntityId: caseRow.id,
      linkHref,
    })

    await notificationService.createForNotificationType(notificationInput, {
      tenantId: payload.tenantId,
      organizationId: payload.organizationId ?? null,
    })
  } catch (err) {
    console.error('[cases:case-created-notification] Failed to create notification:', err)
  }
}
