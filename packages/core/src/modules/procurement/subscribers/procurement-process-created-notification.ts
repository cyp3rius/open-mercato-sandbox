import type { EntityManager } from '@mikro-orm/postgresql'
import { resolveNotificationService } from '../../notifications/lib/notificationService'
import { buildFeatureNotificationFromType } from '../../notifications/lib/notificationBuilder'
import { notificationTypes } from '../notifications'
import { ProcurementProcess } from '../data/entities'
import { buildProcurementProcessDeepLink } from '../lib/procurementDeepLink'

export const metadata = {
  event: 'procurement.process.created',
  persistent: true,
  id: 'procurement:process-created-notification',
}

type ProcessCreatedPayload = {
  id: string
  tenantId: string
  organizationId: string
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(payload: ProcessCreatedPayload, ctx: ResolverContext) {
  if (!payload.id || !payload.tenantId) return

  try {
    const em = ctx.resolve<EntityManager>('em')
    const process = await em.findOne(ProcurementProcess, {
      id: payload.id,
      deletedAt: null,
    })
    if (!process) return

    const typeDef = notificationTypes.find((type) => type.type === 'procurement.process.created')
    if (!typeDef) return

    const notificationService = resolveNotificationService(ctx)
    const linkHref = buildProcurementProcessDeepLink(process.id)
    const notificationInput = buildFeatureNotificationFromType(typeDef, {
      requiredFeature: 'procurement.processes.manage',
      titleVariables: { title: process.title },
      bodyVariables: { title: process.title },
      sourceEntityType: 'procurement:process',
      sourceEntityId: process.id,
      linkHref,
    })

    await notificationService.createForFeature(notificationInput, {
      tenantId: payload.tenantId,
      organizationId: payload.organizationId ?? null,
    })
  } catch (err) {
    console.error('[procurement:process-created-notification] Failed to create notification:', err)
  }
}
