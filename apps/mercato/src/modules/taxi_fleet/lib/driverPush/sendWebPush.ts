import type { EntityManager } from '@mikro-orm/postgresql'
import webpush from 'web-push'
import { TaxiFleetPushSubscription } from '../../data/entities'
import { resolveWebPushVapidConfig } from './vapid'
import type { DriverPushPayload } from './pushPayload'

type SendResult = {
  attempted: number
  delivered: number
  removed: number
}

function isGoneStatus(statusCode: unknown): boolean {
  return statusCode === 404 || statusCode === 410
}

export async function sendDriverWebPush(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    teamMemberId: string
    payload: DriverPushPayload
  },
): Promise<SendResult> {
  const vapid = resolveWebPushVapidConfig()
  if (!vapid) {
    return { attempted: 0, delivered: 0, removed: 0 }
  }

  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey)

  const subscriptions = await em.find(TaxiFleetPushSubscription, {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    teamMemberId: params.teamMemberId,
    deletedAt: null,
  })

  let delivered = 0
  let removed = 0
  const body = JSON.stringify(params.payload)
  // web-push `topic` must be URL-safe Base64 charset only (A–Z a–z 0–9 - _).
  // Our notification tags use `:` — sanitize; SW still uses payload.tag for renotify.
  const topic = params.payload.tag.replace(/[^A-Za-z0-9\-_]/g, '-').slice(0, 32)

  for (const row of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        body,
        {
          TTL: 60 * 60,
          urgency: params.payload.urgency === 'normal' ? 'normal' : 'high',
          topic,
        },
      )
      delivered += 1
    } catch (error) {
      const statusCode =
        error && typeof error === 'object' && 'statusCode' in error
          ? (error as { statusCode?: number }).statusCode
          : undefined
      if (isGoneStatus(statusCode)) {
        row.deletedAt = new Date()
        row.updatedAt = new Date()
        em.persist(row)
        removed += 1
      } else {
        console.error('[taxi_fleet/driver-push] send failed', {
          subscriptionId: row.id,
          statusCode,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  if (removed > 0) await em.flush()

  return { attempted: subscriptions.length, delivered, removed }
}
