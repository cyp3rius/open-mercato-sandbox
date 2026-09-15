import type { EntityManager } from '@mikro-orm/postgresql'
import { shouldDeliverPush } from '@open-mercato/core/modules/notifications/lib/notificationPreferenceService'
import {
  TaxiFleetDriverCommunication,
  TaxiFleetDriverCommunicationRecipient,
} from '../../data/entities'
import { buildDriverPushTag } from '../driverPush/pushPayload'
import { sendDriverWebPush } from '../driverPush/sendWebPush'

export function urgencyForCommunicationKind(
  kind: TaxiFleetDriverCommunication['kind'],
): 'normal' | 'high' {
  return kind === 'info' ? 'normal' : 'high'
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
): Promise<{ sent: number; failed: number; skipped: number }> {
  const communication = await em.findOne(TaxiFleetDriverCommunication, {
    id: communicationId,
    deletedAt: null,
  })
  if (!communication) return { sent: 0, failed: 0, skipped: 0 }
  if (communication.status === 'cancelled' || communication.status === 'sent') {
    return { sent: 0, failed: 0, skipped: 0 }
  }

  const now = new Date()
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
    const status = await deliverCommunicationRecipient(em, communication, recipient)
    if (status === 'sent') sent += 1
    else if (status === 'skipped') skipped += 1
    else if (status === 'failed') failed += 1
  }

  communication.status = 'sent'
  communication.sentAt = now
  communication.updatedAt = now
  em.persist(communication)
  await em.flush()

  return { sent, failed, skipped }
}

export async function processDueDriverCommunicationsForOrg(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
  now: Date = new Date(),
): Promise<{ scanned: number; delivered: number }> {
  const due = await em.find(TaxiFleetDriverCommunication, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    status: 'scheduled',
    scheduledAt: { $lte: now },
    deletedAt: null,
  })

  let delivered = 0
  for (const row of due) {
    const result = await deliverCommunication(em, row.id)
    delivered += result.sent + result.failed + result.skipped
  }
  return { scanned: due.length, delivered }
}
