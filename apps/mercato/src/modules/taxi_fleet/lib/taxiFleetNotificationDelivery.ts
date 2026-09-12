import type { EntityManager } from '@mikro-orm/postgresql'
import { resolveNotificationService } from '@open-mercato/core/modules/notifications/lib/notificationService'
import {
  buildNotificationFromType,
  buildFeatureNotificationFromType,
} from '@open-mercato/core/modules/notifications/lib/notificationBuilder'
import {
  resolveRecipientsForNotificationType,
  shouldDeliverNotification,
} from '@open-mercato/core/modules/notifications/lib/notificationPreferenceService'
import type { NotificationTypeDefinition } from '@open-mercato/shared/modules/notifications/types'
import { notificationTypes } from '../notifications'

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

type DeliveryContext = {
  tenantId: string
  organizationId: string
}

type BroadcastOptions = DeliveryContext & {
  notificationType: string
  titleVariables?: Record<string, string>
  bodyVariables?: Record<string, string>
  sourceEntityType: string
  sourceEntityId: string
  linkHref: string
  groupKey?: string
  logLabel: string
}

type PersonalOptions = BroadcastOptions & {
  recipientUserId: string
}

function findTypeDef(notificationType: string): NotificationTypeDefinition | undefined {
  return notificationTypes.find((entry) => entry.type === notificationType)
}

export async function notifyTaxiFleetBroadcast(
  ctx: ResolverContext,
  options: BroadcastOptions,
): Promise<void> {
  try {
    const em = ctx.resolve<EntityManager>('em')
    const typeDef = findTypeDef(options.notificationType)
    if (!typeDef) return

    const notificationService = resolveNotificationService(ctx)
    const recipients = await resolveRecipientsForNotificationType(em, options.tenantId, options.notificationType)
    if (!recipients.length) return

    const deliveryContext = {
      tenantId: options.tenantId,
      organizationId: options.organizationId,
    }

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
      await notificationService.create(notificationInput, deliveryContext)
    }
  } catch (error) {
    console.error(`[${options.logLabel}] broadcast notification failed`, error)
  }
}

export async function notifyTaxiFleetPersonal(
  ctx: ResolverContext,
  options: PersonalOptions,
): Promise<void> {
  try {
    const em = ctx.resolve<EntityManager>('em')
    const typeDef = findTypeDef(options.notificationType)
    if (!typeDef) return

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

    await notificationService.create(notificationInput, {
      tenantId: options.tenantId,
      organizationId: options.organizationId,
    })
  } catch (error) {
    console.error(`[${options.logLabel}] personal notification failed`, error)
  }
}

export async function notifyTaxiFleetFeatureUsers(
  ctx: ResolverContext,
  options: BroadcastOptions & { requiredFeature: string },
): Promise<void> {
  try {
    const typeDef = findTypeDef(options.notificationType)
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

    await notificationService.createForNotificationType(notificationInput, {
      tenantId: options.tenantId,
      organizationId: options.organizationId,
    })
  } catch (error) {
    console.error(`[${options.logLabel}] feature notification failed`, error)
  }
}

export function buildTripLink(tripId: string): string {
  return `/backend/taxi-fleet/trips/${encodeURIComponent(tripId)}`
}

export function buildSettlementLink(settlementId: string): string {
  return `/backend/taxi-fleet/settlements/${encodeURIComponent(settlementId)}`
}

export function buildDriverProfileLink(profileId: string): string {
  return `/backend/taxi-fleet/drivers/${encodeURIComponent(profileId)}`
}
