import type { EntityManager } from '@mikro-orm/postgresql'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { createStoredAttachment, CreateStoredAttachmentError } from '@open-mercato/core/modules/attachments/lib/createStoredAttachment'
import {
  fetchRemoteFileForAttachmentImport,
  ImportRemoteUrlError,
} from '@open-mercato/core/modules/attachments/lib/importRemoteUrl'
import { INSURANCE_LEAD_ATTACHMENT_ENTITY_ID, INSURANCE_LEAD_ATTACHMENT_TAG } from './insuranceDeskConstants'

export type LeadAttachmentImportInput = {
  sourceUrl?: string | null
  url?: string | null
  fileName?: string | null
  name?: string | null
  tags?: string[] | null
}

export type ImportedLeadAttachment = {
  id: string
  fileName: string
  url: string
}

function sanitizeFileName(raw: string | null | undefined, fallback: string): string {
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  const base = trimmed.length ? trimmed : fallback
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 240)
}

export function collectLeadAttachmentInputs(
  topLevel: unknown,
  strapiPayload: Record<string, unknown>,
): LeadAttachmentImportInput[] {
  const out: LeadAttachmentImportInput[] = []
  const push = (item: unknown) => {
    if (!item || typeof item !== 'object') return
    const row = item as Record<string, unknown>
    const sourceUrl =
      (typeof row.sourceUrl === 'string' && row.sourceUrl.trim().length ? row.sourceUrl.trim() : null) ??
      (typeof row.url === 'string' && row.url.trim().length ? row.url.trim() : null)
    if (!sourceUrl) return
    out.push({
      sourceUrl,
      url: sourceUrl,
      fileName: typeof row.fileName === 'string' ? row.fileName : typeof row.name === 'string' ? row.name : typeof row.filename === 'string' ? row.filename : null,
      name: typeof row.name === 'string' ? row.name : typeof row.filename === 'string' ? row.filename : null,
      tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === 'string') : undefined,
    })
  }

  if (Array.isArray(topLevel)) {
    for (const item of topLevel) push(item)
  }

  for (const key of ['files', 'stagedMailAttachments', 'attachments'] as const) {
    const list = strapiPayload[key]
    if (!Array.isArray(list)) continue
    for (const item of list) push(item)
  }

  const seen = new Set<string>()
  return out.filter((item) => {
    const url = item.sourceUrl ?? item.url
    if (!url || seen.has(url)) return false
    seen.add(url)
    return true
  })
}

export async function importAttachmentsForLead(
  ctx: CommandRuntimeContext,
  params: {
    organizationId: string
    tenantId: string
    leadId: string
    attachments: LeadAttachmentImportInput[]
  },
): Promise<{ imported: ImportedLeadAttachment[]; errors: Array<{ sourceUrl: string; error: string }> }> {
  if (!params.attachments.length) {
    return { imported: [], errors: [] }
  }

  const em = (ctx.container.resolve('em') as EntityManager).fork()
  const dataEngine = ctx.container.resolve('dataEngine') as DataEngine | undefined
  const imported: ImportedLeadAttachment[] = []
  const errors: Array<{ sourceUrl: string; error: string }> = []

  for (const attachment of params.attachments) {
    const sourceUrl = attachment.sourceUrl ?? attachment.url
    if (!sourceUrl) continue
    try {
      const fetched = await fetchRemoteFileForAttachmentImport(sourceUrl)
      const fileName = sanitizeFileName(
        attachment.fileName ?? attachment.name,
        fetched.fileName || 'attachment',
      )
      const tags = attachment.tags?.length
        ? attachment.tags
        : [INSURANCE_LEAD_ATTACHMENT_TAG.default]
      const { item } = await createStoredAttachment({
        em,
        dataEngine,
        auth: { tenantId: params.tenantId, orgId: params.organizationId },
        entityId: INSURANCE_LEAD_ATTACHMENT_ENTITY_ID,
        recordId: params.leadId,
        buffer: fetched.buffer,
        fileName,
        mimeType: fetched.mimeType,
        tags,
        assignmentsFromForm: [],
        customFieldValues: {},
        partitionOverride: null,
      })
      imported.push({
        id: item.id,
        fileName: item.fileName,
        url: item.url,
      })
    } catch (err) {
      const message =
        err instanceof ImportRemoteUrlError || err instanceof CreateStoredAttachmentError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Attachment import failed'
      errors.push({ sourceUrl, error: message })
    }
  }

  return { imported, errors }
}
