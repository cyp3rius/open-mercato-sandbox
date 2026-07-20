import type { AwilixContainer } from 'awilix'
import { resolveNotificationService } from '@open-mercato/core/modules/notifications/lib/notificationService'
import { buildFeatureNotificationFromType } from '@open-mercato/core/modules/notifications/lib/notificationBuilder'
import type { NotificationTypeDefinition } from '@open-mercato/shared/modules/notifications/types'

/**
 * Role-driven fan-out for inject notifications (`createForFeature`).
 */
export async function notifyInjectFeatureUsers(
  container: AwilixContainer,
  options: {
    notificationTypes: NotificationTypeDefinition[]
    notificationType: string
    requiredFeature: string
    tenantId: string
    organizationId: string
    titleVariables?: Record<string, string>
    bodyVariables?: Record<string, string>
    sourceEntityType: string
    sourceEntityId: string
    linkHref: string
    logLabel: string
  },
): Promise<void> {
  try {
    const typeDef = options.notificationTypes.find((entry) => entry.type === options.notificationType)
    if (!typeDef) return

    const notificationService = resolveNotificationService(container)
    const input = buildFeatureNotificationFromType(typeDef, {
      requiredFeature: options.requiredFeature,
      titleVariables: options.titleVariables,
      bodyVariables: options.bodyVariables,
      sourceEntityType: options.sourceEntityType,
      sourceEntityId: options.sourceEntityId,
      linkHref: options.linkHref,
    })

    await notificationService.createForFeature(input, {
      tenantId: options.tenantId,
      organizationId: options.organizationId,
    })
  } catch (error) {
    console.error(`[${options.logLabel}] notification failed`, error)
  }
}
