import { randomUUID } from 'crypto'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import { emitCrudSideEffects, setCustomFieldsIfAny } from '@open-mercato/shared/lib/commands/helpers'
import { E } from '#generated/entities.ids.generated'
import { buildAttachmentFileUrl, buildAttachmentImageUrl, slugifyAttachmentFileName } from './imageUrls'
import { ensureDefaultPartitions, resolveDefaultPartitionCode, sanitizePartitionCode } from './partitions'
import { Attachment, AttachmentPartition } from '../data/entities'
import { getStorageDriverFactory, resolveTenantStorageDriverKey } from './drivers'
import { extractAttachmentContent } from './textExtraction'
import { requestOcrProcessing } from './ocrQueue'
import { OcrService, shouldUseLlmOcr } from './ocrService'
import {
  mergeAttachmentMetadata,
  readAttachmentMetadata,
  upsertAssignment,
  type AttachmentAssignment,
} from './metadata'
import { attachmentCrudEvents, attachmentCrudIndexer } from './crud'
import { resolveDefaultAttachmentOcrEnabled } from './ocrConfig'

const LIBRARY_ENTITY_ID = 'attachments:library'

export type StoredAttachmentAuth = {
  tenantId: string
  orgId: string
}

export type CreateStoredAttachmentInput = {
  em: EntityManager
  dataEngine: DataEngine | undefined
  auth: StoredAttachmentAuth
  entityId: string
  recordId: string
  buffer: Buffer
  fileName: string
  mimeType: string
  fieldKey?: string
  tags?: string[]
  assignmentsFromForm?: AttachmentAssignment[]
  customFieldValues?: Record<string, unknown>
  partitionOverride?: string | null
}

export type StoredAttachmentResult = {
  attachmentId: string
  item: {
    id: string
    url: string
    fileName: string
    fileSize: number
    partitionCode: string
    thumbnailUrl?: string
    content: string | null
    tags: string[]
    assignments: AttachmentAssignment[]
    customFields?: Record<string, unknown>
  }
}

export async function createStoredAttachment(input: CreateStoredAttachmentInput): Promise<StoredAttachmentResult> {
  const {
    em,
    dataEngine,
    auth,
    entityId,
    recordId,
    buffer,
    fileName: rawName,
    mimeType: rawMime,
    fieldKey = '',
    tags: tagsInput,
    assignmentsFromForm: assignmentsInput,
    customFieldValues = {},
    partitionOverride: partitionOverrideRaw,
  } = input

  const tenantId = auth.tenantId
  const orgId = auth.orgId
  const tags = tagsInput ?? []
  const assignmentsFromForm = assignmentsInput ?? []

  const safeName = String(rawName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')
  const fileMimeType = rawMime.trim().length > 0 ? rawMime.trim() : 'application/octet-stream'

  await ensureDefaultPartitions(em)

  let partitionFromField: string | null = null
  if (fieldKey) {
    try {
      const { CustomFieldDef } = await import('@open-mercato/core/modules/entities/data/entities')
      const def = await em.findOne(CustomFieldDef, {
        entityId,
        key: fieldKey,
        $and: [{ $or: [{ tenantId: auth.tenantId }, { tenantId: null }] }],
        isActive: true,
      })
      const cfg = (def as { configJson?: Record<string, unknown> } | null)?.configJson || {}
      const ext = safeName.split('.').pop()?.toLowerCase() || ''
      if (Array.isArray(cfg.acceptExtensions) && cfg.acceptExtensions.length) {
        const allowed = new Set(
          (cfg.acceptExtensions as unknown[]).map((x) => String(x).toLowerCase().replace(/^\./, '')),
        )
        if (!allowed.has(ext)) {
          throw new CreateStoredAttachmentError('File type not allowed', 400)
        }
      }
      if (typeof cfg.maxAttachmentSizeMb === 'number' && cfg.maxAttachmentSizeMb > 0) {
        const maxBytes = Math.floor(cfg.maxAttachmentSizeMb * 1024 * 1024)
        if (buffer.byteLength > maxBytes) {
          throw new CreateStoredAttachmentError(`File exceeds ${cfg.maxAttachmentSizeMb} MB limit`, 400)
        }
      }
      if (typeof cfg.partitionCode === 'string' && cfg.partitionCode.trim().length > 0) {
        partitionFromField = sanitizePartitionCode(cfg.partitionCode)
      }
    } catch (e) {
      if (e instanceof CreateStoredAttachmentError) throw e
    }
  }

  const partitionOverride =
    typeof partitionOverrideRaw === 'string' && partitionOverrideRaw.trim().length > 0
      ? sanitizePartitionCode(partitionOverrideRaw)
      : null

  const resolvedPartitionCode = partitionOverride ?? partitionFromField ?? resolveDefaultPartitionCode(entityId)
  const partitionCodeCandidates = Array.from(
    new Set(
      [partitionOverride, partitionFromField, resolvedPartitionCode].filter(
        (code): code is string => typeof code === 'string' && code.length > 0,
      ),
    ),
  )
  let partition: AttachmentPartition | null = null
  for (const code of partitionCodeCandidates) {
    const record = await em.findOne(AttachmentPartition, { code })
    if (record) {
      partition = record
      break
    }
  }
  if (!partition) {
    partition = await em.findOne(AttachmentPartition, { code: resolveDefaultPartitionCode(entityId) })
  }
  if (!partition) {
    throw new CreateStoredAttachmentError('Storage partition is not configured.', 400)
  }

  const storageDriverKey = resolveTenantStorageDriverKey(tenantId)
  const storageDriver = getStorageDriverFactory().resolve(storageDriverKey)
  let stored
  try {
    stored = await storageDriver.store({
      partitionCode: partition.code,
      orgId,
      tenantId,
      fileName: safeName,
      buffer,
    })
  } catch (error) {
    console.error('[attachments] failed to persist file', error)
    throw new CreateStoredAttachmentError('Failed to persist attachment.', 500)
  }

  const requiresOcr =
    typeof (partition as { requiresOcr?: boolean }).requiresOcr === 'boolean'
      ? Boolean((partition as { requiresOcr?: boolean }).requiresOcr)
      : resolveDefaultAttachmentOcrEnabled()
  let extractedContent: string | null = null
  const useLlmOcr = requiresOcr && shouldUseLlmOcr(fileMimeType, safeName)

  const localPath = await storageDriver.toLocalPath(partition.code, stored.storagePath)
  try {
    if (requiresOcr && !useLlmOcr) {
      try {
        extractedContent = await extractAttachmentContent({
          filePath: localPath.filePath,
          mimeType: fileMimeType,
        })
      } catch (error) {
        console.error('[attachments] failed to extract attachment content', error)
      }
    }

    let assignments = assignmentsFromForm.slice()
    if (entityId !== LIBRARY_ENTITY_ID) {
      assignments = upsertAssignment(assignments, { type: entityId, id: recordId })
    }
    const metadata = mergeAttachmentMetadata(null, { assignments, tags })
    const attachmentId = randomUUID()
    const att = em.create(Attachment, {
      id: attachmentId,
      entityId,
      recordId,
      organizationId: orgId,
      tenantId,
      fileName: safeName,
      mimeType: fileMimeType,
      fileSize: buffer.length,
      partitionCode: partition.code,
      storageDriver: storageDriverKey,
      storagePath: stored.storagePath,
      url: buildAttachmentFileUrl(attachmentId),
      content: extractedContent,
      storageMetadata: metadata,
    })
    await em.persistAndFlush(att)

    if (useLlmOcr) {
      const ocrService = new OcrService()
      if (ocrService.available) {
        requestOcrProcessing(em, att).catch((error) => {
          console.error('[attachments] failed to queue OCR processing', error)
        })
      } else {
        console.warn('[attachments] OCR requested but OPENAI_API_KEY not configured')
      }
    }

    const metaRead = readAttachmentMetadata(att.storageMetadata)

    if (dataEngine) {
      try {
        await setCustomFieldsIfAny({
          dataEngine,
          entityId: E.attachments.attachment,
          recordId: attachmentId,
          tenantId,
          organizationId: orgId,
          values: customFieldValues,
        })
      } catch (error) {
        console.error('[attachments] failed to persist custom attributes', error)
        throw new CreateStoredAttachmentError('Failed to save attachment attributes.', 500)
      }
      await emitCrudSideEffects({
        dataEngine,
        action: 'created',
        entity: att,
        identifiers: {
          id: att.id,
          organizationId: att.organizationId ?? null,
          tenantId: att.tenantId ?? null,
        },
        events: attachmentCrudEvents,
        indexer: attachmentCrudIndexer,
      })
      await dataEngine.flushOrmEntityChanges()
    }

    return {
      attachmentId,
      item: {
        id: attachmentId,
        url: att.url,
        fileName: safeName,
        fileSize: buffer.length,
        partitionCode: partition.code,
        thumbnailUrl: buildAttachmentImageUrl(attachmentId, {
          width: 320,
          height: 320,
          slug: slugifyAttachmentFileName(safeName),
        }),
        content: extractedContent ?? null,
        tags: metaRead.tags ?? [],
        assignments: metaRead.assignments ?? [],
        ...(Object.keys(customFieldValues).length ? { customFields: customFieldValues } : {}),
      },
    }
  } finally {
    await localPath.cleanup()
  }
}

export class CreateStoredAttachmentError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message)
    this.name = 'CreateStoredAttachmentError'
  }
}
