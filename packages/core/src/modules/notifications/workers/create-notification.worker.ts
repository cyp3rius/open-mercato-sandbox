import type { EntityManager } from '@mikro-orm/core'
import type { Knex } from 'knex'
import { Notification } from '../data/entities'
import type { CreateNotificationInput, CreateRoleNotificationInput, CreateFeatureNotificationInput } from '../data/validators'
import { buildNotificationEntity, emitNotificationCreated, emitNotificationCreatedBatch } from '../lib/notificationFactory'
import { getRecipientUserIdsForFeature, getRecipientUserIdsForRole } from '../lib/notificationRecipients'
import {
  filterRecipientsByNotificationPreferences,
  resolveRecipientsForNotificationType,
  shouldDeliverNotification,
} from '../lib/notificationPreferenceService'

function getKnex(em: EntityManager): Knex {
  return (em.getConnection() as unknown as { getKnex: () => Knex }).getKnex()
}

export const NOTIFICATIONS_QUEUE_NAME = 'notifications'

export type CreateNotificationJob = {
  type: 'create'
  input: CreateNotificationInput
  tenantId: string
  organizationId?: string | null
}

export type CreateRoleNotificationJob = {
  type: 'create-role'
  input: CreateRoleNotificationInput
  tenantId: string
  organizationId?: string | null
}

export type CreateFeatureNotificationJob = {
  type: 'create-feature'
  input: CreateFeatureNotificationInput
  tenantId: string
  organizationId?: string | null
}

export type CleanupExpiredJob = {
  type: 'cleanup-expired'
}

export type NotificationJob = CreateNotificationJob | CreateRoleNotificationJob | CreateFeatureNotificationJob | CleanupExpiredJob

export const metadata = {
  queue: NOTIFICATIONS_QUEUE_NAME,
  id: 'notifications:create',
  concurrency: 5,
}

type HandlerContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(
  job: { payload: NotificationJob },
  ctx: HandlerContext
): Promise<void> {
  const { payload } = job

  if (payload.type === 'create') {
    const em = (ctx.resolve('em') as EntityManager).fork()
    const eventBus = ctx.resolve('eventBus') as { emit: (event: string, payload: unknown) => Promise<void> }
    const { input, tenantId, organizationId } = payload
    const { recipientUserId, ...content } = input

    const canDeliver = await shouldDeliverNotification(em, recipientUserId, tenantId, content.type)
    if (!canDeliver) {
      return
    }

    const notification = buildNotificationEntity(em, content, recipientUserId, { tenantId, organizationId })

    await em.persistAndFlush(notification)

    await emitNotificationCreated(eventBus, notification, { tenantId, organizationId })
  } else if (payload.type === 'create-role') {
    const em = (ctx.resolve('em') as EntityManager).fork()
    const eventBus = ctx.resolve('eventBus') as { emit: (event: string, payload: unknown) => Promise<void> }
    const { input, tenantId, organizationId } = payload

    const knex = getKnex(em)
    const recipientUserIds = await getRecipientUserIdsForRole(knex, tenantId, input.roleId)
    const filteredRecipientUserIds = await filterRecipientsByNotificationPreferences(
      em,
      tenantId,
      input.type,
      recipientUserIds,
    )
    if (filteredRecipientUserIds.length === 0) {
      return
    }

    const { roleId: _roleId, ...content } = input
    const notifications: Notification[] = []
    for (const recipientUserId of filteredRecipientUserIds) {
      const notification = buildNotificationEntity(em, content, recipientUserId, { tenantId, organizationId })
      notifications.push(notification)
    }

    await em.persistAndFlush(notifications)

    await emitNotificationCreatedBatch(eventBus, notifications, { tenantId, organizationId })
  } else if (payload.type === 'create-feature') {
    const em = (ctx.resolve('em') as EntityManager).fork()
    const eventBus = ctx.resolve('eventBus') as { emit: (event: string, payload: unknown) => Promise<void> }
    const { input, tenantId, organizationId } = payload

    const knex = getKnex(em)
    const recipientUserIds = await getRecipientUserIdsForFeature(knex, tenantId, input.requiredFeature)
    const filteredRecipientUserIds = await filterRecipientsByNotificationPreferences(
      em,
      tenantId,
      input.type,
      recipientUserIds,
    )

    if (filteredRecipientUserIds.length === 0) {
      return
    }

    const notifications: Notification[] = []
    const { requiredFeature: _requiredFeature, ...content } = input
    for (const recipientUserId of filteredRecipientUserIds) {
      const notification = buildNotificationEntity(em, content, recipientUserId, { tenantId, organizationId })
      notifications.push(notification)
    }

    await em.persistAndFlush(notifications)

    await emitNotificationCreatedBatch(eventBus, notifications, { tenantId, organizationId })
  } else if (payload.type === 'cleanup-expired') {
    const em = (ctx.resolve('em') as EntityManager).fork()
    const knex = getKnex(em)

    await knex('notifications')
      .where('expires_at', '<', knex.fn.now())
      .whereNotIn('status', ['actioned', 'dismissed'])
      .update({
        status: 'dismissed',
        dismissed_at: knex.fn.now(),
      })
  }
}
