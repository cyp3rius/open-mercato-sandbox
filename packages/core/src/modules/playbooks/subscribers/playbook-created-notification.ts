import type { EntityManager } from '@mikro-orm/postgresql'
import { resolveNotificationService } from '../../notifications/lib/notificationService'
import { buildFeatureNotificationFromType } from '../../notifications/lib/notificationBuilder'
import { notificationTypes } from '../notifications'
import { Playbook } from '../data/entities'

export const metadata = {
  event: 'playbooks.playbook.created',
  persistent: true,
  id: 'playbooks:playbook-created-notification',
}

type PlaybookCreatedPayload = {
  id: string
  tenantId: string
  organizationId: string
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(payload: PlaybookCreatedPayload, ctx: ResolverContext) {
  if (!payload.id || !payload.tenantId) return

  try {
    const em = ctx.resolve<EntityManager>('em')
    const playbook = await em.findOne(Playbook, { id: payload.id, deletedAt: null })
    if (!playbook) return

    const typeDef = notificationTypes.find((type) => type.type === 'playbooks.playbook.created')
    if (!typeDef) return

    const notificationService = resolveNotificationService(ctx)
    const linkHref = `/backend/playbooks/${encodeURIComponent(playbook.id)}`
    const notificationInput = buildFeatureNotificationFromType(typeDef, {
      requiredFeature: 'playbooks.edit',
      titleVariables: { title: playbook.title },
      bodyVariables: { title: playbook.title, slug: playbook.slug },
      sourceEntityType: 'playbooks:playbook',
      sourceEntityId: playbook.id,
      linkHref,
    })

    await notificationService.createForFeature(notificationInput, {
      tenantId: payload.tenantId,
      organizationId: payload.organizationId ?? null,
    })
  } catch (err) {
    console.error('[playbooks:playbook-created-notification] Failed to create notification:', err)
  }
}
