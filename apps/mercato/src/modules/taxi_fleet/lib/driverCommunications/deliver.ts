import type { EntityManager } from '@mikro-orm/postgresql'
import { shouldDeliverPush } from '@open-mercato/core/modules/notifications/lib/notificationPreferenceService'
import {
  TaxiFleetDriverCommunication,
  TaxiFleetDriverCommunicationRecipient,
} from '../../data/entities'
import { buildDriverPushTag } from '../driverPush/pushPayload'
import { sendDriverWebPush } from '../driverPush/sendWebPush'

/** Cap automatic retries so stale subscriptions do not retry forever. */
export const DRIVER_COMMUNICATION_MAX_ATTEMPTS = 24

const RETRY_BACKOFF_MS = [
  60_000, // 1m
  5 * 60_000, // 5m
  15 * 60_000, // 15m
  60 * 60_000, // 1h
  4 * 60 * 60_000, // 4h
  12 * 60 * 60_000, // 12h
] as const

export function urgencyForCommunicationKind(
  kind: TaxiFleetDriverCommunication['kind'],
): 'normal' | 'high' {
  return kind === 'info' ? 'normal' : 'high'
}

export function isRecipientDueForRetry(
  recipient: Pick<
    TaxiFleetDriverCommunicationRecipient,
    'deliveryStatus' | 'attemptCount' | 'lastAttemptAt'
  >,
  now: Date = new Date(),
): boolean {
  if (recipient.deliveryStatus !== 'failed' && recipient.deliveryStatus !== 'pending') {
    return false
  }
  if ((recipient.attemptCount ?? 0) >= DRIVER_COMMUNICATION_MAX_ATTEMPTS) {
    return false
  }
  if (!recipient.lastAttemptAt) return true
  const attemptIndex = Math.max(0, (recipient.attemptCount ?? 1) - 1)
  const delay =
    RETRY_BACKOFF_MS[Math.min(attemptIndex, RETRY_BACKOFF_MS.length - 1)] ??
    RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1]
  return recipient.lastAttemptAt.getTime() + delay <= now.getTime()
}

export function resolveCommunicationStatusFromRecipients(
  recipients: Array<Pick<TaxiFleetDriverCommunicationRecipient, 'deliveryStatus'>>,
): 'sent' | 'partial' {
  if (recipients.length === 0) return 'sent'
  const hasOpen = recipients.some(
    (row) => row.deliveryStatus === 'failed' || row.deliveryStatus === 'pending',
  )
  return hasOpen ? 'partial' : 'sent'
}

async function refreshCommunicationStatus(
  em: EntityManager,
  communication: TaxiFleetDriverCommunication,
): Promise<'sent' | 'partial'> {
  const recipients = await em.find(TaxiFleetDriverCommunicationRecipient, {
    communicationId: communication.id,
  })
  const nextStatus = resolveCommunicationStatusFromRecipients(recipients)
  const now = new Date()
  communication.status = nextStatus
  if (nextStatus === 'sent' || !communication.sentAt) {
    communication.sentAt = communication.sentAt ?? now
  }
  communication.updatedAt = now
  em.persist(communication)
  return nextStatus
}

export async function deliverCommunicationRecipient(
  em: EntityManager,
  communication: TaxiFleetDriverCommunication,
  recipient: TaxiFleetDriverCommunicationRecipient,
): Promise<TaxiFleetDriverCommunicationRecipient['deliveryStatus']> {
  const now = new Date()
  recipient.attemptCount = (recipient.attemptCount ?? 0) + 1
  recipient.lastAttemptAt = now
  recipient.updatedAt = now

  const allowed = await shouldDeliverPush(
    em,
    recipient.userId,
    communication.tenantId,
    'taxi_fleet.driver_broadcast',
  )
  if (!allowed) {
    recipient.deliveryStatus = 'skipped'
    recipient.lastError = null
    em.persist(recipient)
    return 'skipped'
  }

  try {
    const result = await sendDriverWebPush(em, {
      tenantId: communication.tenantId,
      organizationId: communication.organizationId,
      teamMemberId: recipient.teamMemberId,
      payload: {
        kind: 'driver_broadcast',
        communicationId: communication.id,
        recipientId: recipient.id,
        url: '/driver',
        title: communication.title,
        body: communication.body,
        tag: buildDriverPushTag('driver_broadcast', recipient.id),
        urgency: urgencyForCommunicationKind(communication.kind),
      },
    })
    if (result.attempted === 0) {
      recipient.deliveryStatus = 'failed'
      recipient.lastError = 'Web Push is not configured or no subscription'
    } else if (result.delivered > 0) {
      recipient.deliveryStatus = 'sent'
      recipient.lastError = null
    } else {
      recipient.deliveryStatus = 'failed'
      recipient.lastError = 'Push delivery failed'
    }
  } catch (error) {
    recipient.deliveryStatus = 'failed'
    recipient.lastError = error instanceof Error ? error.message : String(error)
  }

  em.persist(recipient)
  return recipient.deliveryStatus
}

export async function deliverCommunication(
  em: EntityManager,
  communicationId: string,
  opts?: { respectBackoff?: boolean; now?: Date },
): Promise<{ sent: number; failed: number; skipped: number }> {
  const now = opts?.now ?? new Date()
  const respectBackoff = opts?.respectBackoff === true
  const communication = await em.findOne(TaxiFleetDriverCommunication, {
    id: communicationId,
    deletedAt: null,
  })
  if (!communication) return { sent: 0, failed: 0, skipped: 0 }
  if (communication.status === 'cancelled') {
    return { sent: 0, failed: 0, skipped: 0 }
  }
  // Fully delivered — nothing left to send.
  if (communication.status === 'sent') {
    return { sent: 0, failed: 0, skipped: 0 }
  }

  communication.status = 'sending'
  communication.updatedAt = now
  em.persist(communication)
  await em.flush()

  const recipients = await em.find(TaxiFleetDriverCommunicationRecipient, {
    communicationId: communication.id,
    deliveryStatus: { $in: ['pending', 'failed'] },
  })

  let sent = 0
  let failed = 0
  let skipped = 0
  for (const recipient of recipients) {
    if (respectBackoff && !isRecipientDueForRetry(recipient, now)) {
      continue
    }
    const status = await deliverCommunicationRecipient(em, communication, recipient)
    if (status === 'sent') sent += 1
    else if (status === 'skipped') skipped += 1
    else if (status === 'failed') failed += 1
  }

  await refreshCommunicationStatus(em, communication)
  await em.flush()

  return { sent, failed, skipped }
}

export async function processDueDriverCommunicationsForOrg(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
  now: Date = new Date(),
): Promise<{ scanned: number; delivered: number; retried: number }> {
  const due = await em.find(TaxiFleetDriverCommunication, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    status: 'scheduled',
    scheduledAt: { $lte: now },
    deletedAt: null,
  })

  let delivered = 0
  for (const row of due) {
    const result = await deliverCommunication(em, row.id, { now })
    delivered += result.sent + result.failed + result.skipped
  }

  // Includes `partial` / stuck `sending`, and heals legacy `sent` rows that still have open recipients.
  const openRecipients = await em.find(TaxiFleetDriverCommunicationRecipient, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    deliveryStatus: { $in: ['pending', 'failed'] },
    attemptCount: { $lt: DRIVER_COMMUNICATION_MAX_ATTEMPTS },
  })
  const communicationIds = [...new Set(openRecipients.map((row) => row.communicationId))]
  const openParents =
    communicationIds.length === 0
      ? []
      : await em.find(TaxiFleetDriverCommunication, {
          id: { $in: communicationIds },
          tenantId: scope.tenantId,
          organizationId: scope.organizationId,
          status: { $in: ['partial', 'sending', 'sent'] },
          deletedAt: null,
        })

  let retried = 0
  for (const row of openParents) {
    // Allow retry loop even when status was incorrectly marked `sent`.
    if (row.status === 'sent') {
      row.status = 'partial'
      row.updatedAt = now
      em.persist(row)
      await em.flush()
    }
    const result = await deliverCommunication(em, row.id, { respectBackoff: true, now })
    retried += result.sent + result.failed + result.skipped
  }

  return { scanned: due.length + openParents.length, delivered, retried }
}

