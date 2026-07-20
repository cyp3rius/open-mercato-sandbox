import { notifyFeatureUsersFromType } from '../../notifications/lib/moduleNotificationDelivery'
import {
  PLAYBOOKS_VERSION_PUBLISHED_NOTIFY_FEATURE,
  notificationTypes,
} from '../notifications'

export const metadata = {
  event: 'playbooks.playbook.version_published',
  persistent: true,
  id: 'playbooks:playbook-version-published-notification',
}

type PlaybookVersionPublishedPayload = {
  playbookId: string
  slug: string
  title: string
  version: number
  tenantId: string
  organizationId: string
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(payload: PlaybookVersionPublishedPayload, ctx: ResolverContext) {
  if (!payload.playbookId || !payload.tenantId) return

  const linkHref = `/backend/playbooks/${encodeURIComponent(payload.playbookId)}`
  await notifyFeatureUsersFromType(ctx, {
    notificationType: 'playbooks.playbook.version_published',
    types: notificationTypes,
    requiredFeature: PLAYBOOKS_VERSION_PUBLISHED_NOTIFY_FEATURE,
    tenantId: payload.tenantId,
    organizationId: payload.organizationId ?? null,
    titleVariables: { title: payload.title, version: String(payload.version) },
    bodyVariables: {
      title: payload.title,
      slug: payload.slug,
      version: String(payload.version),
    },
    sourceEntityType: 'playbooks:playbook',
    sourceEntityId: payload.playbookId,
    linkHref,
    logLabel: 'playbooks:playbook-version-published-notification',
  })
}
