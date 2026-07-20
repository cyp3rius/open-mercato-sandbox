import type { EntityManager } from '@mikro-orm/postgresql'
import { notifyFeatureUsersFromType } from '../../notifications/lib/moduleNotificationDelivery'
import { PLAYBOOKS_CREATED_NOTIFY_FEATURE, notificationTypes } from '../notifications'
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

  const em = ctx.resolve<EntityManager>('em')
  const playbook = await em.findOne(Playbook, { id: payload.id, deletedAt: null })
  if (!playbook) return

  const linkHref = `/backend/playbooks/${encodeURIComponent(playbook.id)}`
  await notifyFeatureUsersFromType(ctx, {
    notificationType: 'playbooks.playbook.created',
    types: notificationTypes,
    requiredFeature: PLAYBOOKS_CREATED_NOTIFY_FEATURE,
    tenantId: payload.tenantId,
    organizationId: payload.organizationId ?? null,
    titleVariables: { title: playbook.title },
    bodyVariables: { title: playbook.title, slug: playbook.slug },
    sourceEntityType: 'playbooks:playbook',
    sourceEntityId: playbook.id,
    linkHref,
    logLabel: 'playbooks:playbook-created-notification',
  })
}
