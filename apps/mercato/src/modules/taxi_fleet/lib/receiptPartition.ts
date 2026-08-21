import type { EntityManager } from '@mikro-orm/postgresql'
import { AttachmentPartition } from '@open-mercato/core/modules/attachments/data/entities'
import { resolveDefaultAttachmentOcrEnabled } from '@open-mercato/core/modules/attachments/lib/ocrConfig'

export const TAXI_FLEET_DRIVER_RECEIPTS_PARTITION = 'taxi_fleet_driver_receipts'

export async function ensureTaxiFleetDriverReceiptsPartition(em: EntityManager): Promise<void> {
  const existing = await em.findOne(AttachmentPartition, { code: TAXI_FLEET_DRIVER_RECEIPTS_PARTITION })
  if (existing) {
    if (!existing.requiresOcr) {
      existing.requiresOcr = true
      await em.flush()
    }
    return
  }
  em.persist(
    em.create(AttachmentPartition, {
      code: TAXI_FLEET_DRIVER_RECEIPTS_PARTITION,
      title: 'Taxi fleet driver receipts',
      description: 'Receipt photos uploaded by drivers for OCR extraction.',
      storageDriver: 'local',
      isPublic: false,
      requiresOcr: resolveDefaultAttachmentOcrEnabled(),
      ocrModel: process.env.OCR_MODEL ?? 'gpt-4o',
    }),
  )
  await em.flush()
}
