import type { EntityManager } from '@mikro-orm/postgresql'
import type { NotificationTypeDefinition } from '@open-mercato/shared/modules/notifications/types'
import {
  buildFeatureNotificationFromType,
  buildNotificationFromType,
} from './notificationBuilder'
import { getNotificationTypeDefinition } from './notification-types-registry'
import {
  resolveRecipientsForNotificationType,
  shouldDeliverNotification,
} from './notificationPreferenceService'
import { resolveNotificationService } from './notificationService'

export type ModuleNotificationResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export type ModuleNotificationDeliveryOptions = {
  notificationType: string
  /** Prefer passing the module's `notificationTypes` export when calling from subscribers. */
  types?: readonly NotificationTypeDefinition[]
  /** Explicit type definition; wins over `types` / registry lookup. */
  typeDef?: NotificationTypeDefinition
  tenantId: string
  organizationId?: string | null
  titleVariables?: Record<string, string>
  bodyVariables?: Record<string, string>
  sourceEntityType: string
  sourceEntityId: string
  linkHref: string
  groupKey?: string
  logLabel: string
}

export type ModuleNotificationPersonalOptions = ModuleNotificationDeliveryOptions & {
  recipientUserId: string
}

export type ModuleNotificationFeatureOptions = ModuleNotificationDeliveryOptions & {
  requiredFeature: string
}

function resolveTypeDef(
  options: ModuleNotificationDeliveryOptions,
): NotificationTypeDefinition | undefined {
  if (options.typeDef) return options.typeDef
  if (options.types) {
    return options.types.find((entry) => entry.type === options.notificationType)
  }
  return getNotificationTypeDefinition(options.notificationType)
}

function deliveryContext(options: ModuleNotificationDeliveryOptions) {
  return {
    tenantId: options.tenantId,
    organizationId: options.organizationId ?? null,
  }
}

/**
 * Fan-out to every user who prefers (or is locked into) the notification type.
 * Prefer this over hand-rolling recipient loops in module subscribers.
 */
export async function notifyBroadcastFromType(
  ctx: ModuleNotificationResolverContext,
  options: ModuleNotificationDeliveryOptions,
): Promise<void> {
  try {
    const typeDef = resolveTypeDef(options)
    if (!typeDef) return

    const em = ctx.resolve<EntityManager>('em')
    const recipients = await resolveRecipientsForNotificationType(
      em,
      options.tenantId,
      options.notificationType,
    )
    if (!recipients.length) return

    const notificationService = resolveNotificationService(ctx)
    const scope = deliveryContext(options)

    for (const recipientUserId of recipients) {
      const notificationInput = buildNotificationFromType(typeDef, {
        recipientUserId,
        titleVariables: options.titleVariables,
        bodyVariables: options.bodyVariables,
        sourceEntityType: options.sourceEntityType,
        sourceEntityId: options.sourceEntityId,
        linkHref: options.linkHref,
        groupKey: options.groupKey,
      })
      await notificationService.create(notificationInput, scope)
    }
  } catch (error) {
    console.error(`[${options.logLabel}] broadcast notification failed`, error)
  }
}

/**
 * Deliver to a single user when their preference (or lock feature) allows it.
 */
export async function notifyPersonalFromType(
  ctx: ModuleNotificationResolverContext,
  options: ModuleNotificationPersonalOptions,
): Promise<void> {
  try {
    const typeDef = resolveTypeDef(options)
    if (!typeDef) return

    const em = ctx.resolve<EntityManager>('em')
    const canDeliver = await shouldDeliverNotification(
      em,
      options.recipientUserId,
      options.tenantId,
      options.notificationType,
    )
    if (!canDeliver) return

    const notificationService = resolveNotificationService(ctx)
    const notificationInput = buildNotificationFromType(typeDef, {
      recipientUserId: options.recipientUserId,
      titleVariables: options.titleVariables,
      bodyVariables: options.bodyVariables,
      sourceEntityType: options.sourceEntityType,
      sourceEntityId: options.sourceEntityId,
      linkHref: options.linkHref,
      groupKey: options.groupKey,
    })

    await notificationService.create(notificationInput, deliveryContext(options))
  } catch (error) {
    console.error(`[${options.logLabel}] personal notification failed`, error)
  }
}

/**
 * Deliver to every user who has `requiredFeature` (role-driven fan-out).
 * Preference locks still apply via the notification service filters.
 */
export async function notifyFeatureUsersFromType(
  ctx: ModuleNotificationResolverContext,
  options: ModuleNotificationFeatureOptions,
): Promise<void> {
  try {
    const typeDef = resolveTypeDef(options)
    if (!typeDef) return

    const notificationService = resolveNotificationService(ctx)
    const notificationInput = buildFeatureNotificationFromType(typeDef, {
      requiredFeature: options.requiredFeature,
      titleVariables: options.titleVariables,
      bodyVariables: options.bodyVariables,
      sourceEntityType: options.sourceEntityType,
      sourceEntityId: options.sourceEntityId,
      linkHref: options.linkHref,
      groupKey: options.groupKey,
    })

    await notificationService.createForFeature(notificationInput, deliveryContext(options))
  } catch (error) {
    console.error(`[${options.logLabel}] feature notification failed`, error)
  }
}

export type NotifyOwnerOnCreateOptions = ModuleNotificationDeliveryOptions & {
  ownerUserId?: string | null
  actorUserId?: string | null
}

/**
 * On create: notify the assigned owner only when they differ from the acting user.
 * Missing actor (e.g. API key) still notifies the owner.
 */
export async function notifyOwnerOnCreateIfDifferentFromActor(
  ctx: ModuleNotificationResolverContext,
  options: NotifyOwnerOnCreateOptions,
): Promise<void> {
  const ownerUserId = typeof options.ownerUserId === 'string' ? options.ownerUserId.trim() : ''
  if (!ownerUserId) return

  const actorUserId = typeof options.actorUserId === 'string' ? options.actorUserId.trim() : ''
  if (actorUserId && actorUserId === ownerUserId) return

  await notifyPersonalFromType(ctx, {
    ...options,
    recipientUserId: ownerUserId,
  })
}
