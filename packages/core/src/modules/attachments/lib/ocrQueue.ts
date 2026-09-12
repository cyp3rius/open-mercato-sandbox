import type { EntityManager } from '@mikro-orm/postgresql'
import { Attachment, AttachmentPartition } from '../data/entities'
import { getStorageDriverFactory } from './drivers'
import { OcrService } from './ocrService'

function scheduleAfterResponse(task: () => void): void {
  void import('next/server')
    .then((mod) => {
      const afterFn = (mod as { after?: (fn: () => void) => void }).after
      if (typeof afterFn === 'function') {
        afterFn(task)
        return
      }
      setImmediate(task)
    })
    .catch(() => {
      setImmediate(task)
    })
}

export type OcrRequestedEvent = {
  attachmentId: string
  mimeType: string
  partitionCode: string
  storagePath: string
  storageDriver: string
  organizationId: string | null
  tenantId: string | null
}

export async function processAttachmentOcr(
  em: EntityManager,
  payload: OcrRequestedEvent
): Promise<void> {
  const { attachmentId, mimeType, partitionCode, storagePath, storageDriver } = payload

  console.log(`[attachments.ocr] Processing started for attachment: ${attachmentId}`)
  const startTime = Date.now()

  const localPath = await getStorageDriverFactory()
    .resolve(storageDriver)
    .toLocalPath(partitionCode, storagePath)

  try {
    const partition = await em.findOne(AttachmentPartition, { code: partitionCode })
    const resolvedModel = partition?.ocrModel ?? process.env.OCR_MODEL ?? 'gpt-4o'

    const ocrService = new OcrService()

    if (!ocrService.available) {
      console.warn(`[attachments.ocr] OPENAI_API_KEY not configured, skipping OCR for: ${attachmentId}`)
      return
    }

    const result = await ocrService.processFile({
      filePath: localPath.filePath,
      mimeType,
      model: resolvedModel,
    })

    if (!result) {
      console.log(`[attachments.ocr] No content extracted for attachment: ${attachmentId}`)
      return
    }

    const attachment = await em.findOne(Attachment, { id: attachmentId })
    if (!attachment) {
      console.error(`[attachments.ocr] Attachment not found: ${attachmentId}`)
      return
    }

    attachment.content = result.content
    await em.persistAndFlush(attachment)

    console.log(`[attachments.ocr] Processing completed:`, {
      attachmentId,
      pageCount: result.pageCount,
      contentLength: result.content.length,
      timeMs: result.processingTimeMs,
      totalTimeMs: Date.now() - startTime,
    })
  } catch (error) {
    console.error(`[attachments.ocr] Processing failed:`, {
      attachmentId,
      error: error instanceof Error ? error.message : String(error),
    })
  } finally {
    await localPath.cleanup()
  }
}

export async function requestOcrProcessing(
  em: EntityManager,
  attachment: Attachment,
): Promise<void> {
  const payload: OcrRequestedEvent = {
    attachmentId: attachment.id,
    mimeType: attachment.mimeType,
    partitionCode: attachment.partitionCode,
    storagePath: attachment.storagePath,
    storageDriver: attachment.storageDriver || 'local',
    organizationId: attachment.organizationId ?? null,
    tenantId: attachment.tenantId ?? null,
  }

  const run = () => {
    const workerEm = typeof (em as { fork?: () => EntityManager }).fork === 'function'
      ? (em as { fork: () => EntityManager }).fork()
      : em
    processAttachmentOcr(workerEm, payload).catch((error) => {
      console.error(`[attachments.ocr] Background processing error:`, error)
    })
  }

  scheduleAfterResponse(run)
}
