import { resolveNotificationService } from '../../notifications/lib/notificationService'
import { buildFeatureNotificationFromType } from '../../notifications/lib/notificationBuilder'
import { notificationTypes } from '../notifications'

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

  try {
    const typeDef = notificationTypes.find((type) => type.type === 'playbooks.playbook.version_published')
    if (!typeDef) return

    const notificationService = resolveNotificationService(ctx)
    const linkHref = `/backend/playbooks/${encodeURIComponent(payload.playbookId)}`
    const notificationInput = buildFeatureNotificationFromType(typeDef, {
      requiredFeature: 'playbooks.view',
      titleVariables: { title: payload.title, version: String(payload.version) },
      bodyVariables: {
        title: payload.title,
        slug: payload.slug,
        version: String(payload.version),
      },
      sourceEntityType: 'playbooks:playbook',
      sourceEntityId: payload.playbookId,
      linkHref,
    })

    await notificationService.createForFeature(notificationInput, {
      tenantId: payload.tenantId,
      organizationId: payload.organizationId ?? null,
    })
  } catch (err) {
    console.error('[playbooks:playbook-version-published-notification] Failed to create notification:', err)
  }
}
