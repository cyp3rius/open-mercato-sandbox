import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { InsuranceLead } from '../../../../data/entities'
import { INSURANCE_LEAD_ATTACHMENT_ENTITY_ID } from '../../../../lib/leadAttachmentConstants'
import { createStoredAttachment, CreateStoredAttachmentError } from '../../../../../attachments/lib/createStoredAttachment'
import {
  fetchRemoteFileForAttachmentImport,
  ImportRemoteUrlError,
} from '../../../../../attachments/lib/importRemoteUrl'
import { parseFormTags } from '../../../../../attachments/lib/formTags'

const jsonImportSchema = z.object({
  sourceUrl: z.string().url(),
  fileName: z.string().min(1).max(512).optional(),
  tags: z.array(z.string()).optional(),
})

const uploadItemSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
  fileName: z.string(),
  fileSize: z.number().int().nonnegative(),
  partitionCode: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  content: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
})

const okResponseSchema = z.object({
  ok: z.literal(true),
  item: uploadItemSchema,
})

const errorSchema = z.object({ error: z.string() })

export const metadata = {
  POST: {
    requireAuth: true,
    requireFeatures: ['insurance.leads.manage', 'attachments.manage'],
  },
}

async function resolveAccessibleLead(
  container: Awaited<ReturnType<typeof createRequestContainer>>,
  em: EntityManager,
  auth: NonNullable<Awaited<ReturnType<typeof getAuthFromRequest>>>,
  req: Request,
  leadId: string,
): Promise<InsuranceLead | null> {
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  const tenantId = scope.tenantId ?? auth.tenantId ?? null
  if (!tenantId) return null

  const allowedOrgIds: string[] = []
  if (Array.isArray(scope.filterIds) && scope.filterIds.length > 0) {
    allowedOrgIds.push(...scope.filterIds)
  } else if (Array.isArray(scope.allowedIds) && scope.allowedIds.length > 0) {
    allowedOrgIds.push(...scope.allowedIds)
  } else if (auth.orgId) {
    allowedOrgIds.push(auth.orgId)
  }

  const found = await em.findOne(InsuranceLead, { id: leadId, tenantId, deletedAt: null })
  if (!found) return null
  const lead = found as InsuranceLead

  if (allowedOrgIds.length > 0) {
    if (!allowedOrgIds.includes(lead.organizationId)) return null
  } else if (auth.isSuperAdmin !== true) {
    return null
  }

  return lead
}

/**
 * POST /api/insurance/leads/[id]/attachments
 *
 * Adds a file to a specific insurance lead using the platform attachment store.
 * - `multipart/form-data` with a `file` field (same semantics as `/api/attachments`, without `entityId`/`recordId`).
 * - `application/json` with `{ "sourceUrl": "https://...", "fileName?": "..." }` to fetch and store a remote file.
 */
export async function POST(req: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  const auth = await getAuthFromRequest(req)
  if (!auth?.tenantId || !auth.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resolved = await context.params
  const leadId = resolved?.id
  if (!leadId || !z.string().uuid().safeParse(leadId).success) {
    return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 })
  }

  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const dataEngine = container.resolve('dataEngine') as import('@open-mercato/shared/lib/data/engine').DataEngine | undefined

  const lead = await resolveAccessibleLead(container, em, auth, req, leadId)
  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  const contentType = (req.headers.get('content-type') || '').toLowerCase()

  let buffer: Buffer
  let fileName: string
  let mimeType: string
  let tags: string[] = []

  if (contentType.includes('application/json')) {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const parsed = jsonImportSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'sourceUrl is required (https URL)' }, { status: 400 })
    }
    const { sourceUrl, fileName: nameOverride, tags: tagList } = parsed.data
    tags = Array.isArray(tagList) ? tagList : []
    try {
      const fetched = await fetchRemoteFileForAttachmentImport(sourceUrl)
      buffer = fetched.buffer
      mimeType = fetched.mimeType
      const override =
        typeof nameOverride === 'string' && nameOverride.trim().length > 0
          ? nameOverride.trim().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 240)
          : null
      fileName = override && override.length > 0 ? override : fetched.fileName
    } catch (e) {
      if (e instanceof ImportRemoteUrlError) {
        return NextResponse.json({ error: e.message }, { status: e.statusCode })
      }
      throw e
    }
  } else if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    const file = form.get('file') as unknown as File | null
    if (!file || typeof file !== 'object') {
      return NextResponse.json({ error: 'file is required (multipart field)' }, { status: 400 })
    }
    tags = parseFormTags(form.get('tags'))
    buffer = Buffer.from(await file.arrayBuffer())
    fileName = String(file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')
    mimeType = (file as { type?: string }).type || 'application/octet-stream'
  } else {
    return NextResponse.json(
      { error: 'Use multipart/form-data with file, or application/json with sourceUrl' },
      { status: 415 },
    )
  }

  try {
    const { item } = await createStoredAttachment({
      em,
      dataEngine,
      auth: { tenantId: auth.tenantId, orgId: auth.orgId },
      entityId: INSURANCE_LEAD_ATTACHMENT_ENTITY_ID,
      recordId: lead.id,
      buffer,
      fileName,
      mimeType,
      tags,
      assignmentsFromForm: [],
      customFieldValues: {},
      partitionOverride: null,
    })
    return NextResponse.json({ ok: true as const, item })
  } catch (e) {
    if (e instanceof CreateStoredAttachmentError) {
      return NextResponse.json({ error: e.message }, { status: e.statusCode })
    }
    throw e
  }
}

export const openApi: OpenApiRouteDoc = {
  summary: 'Add attachment to insurance lead',
  description:
    'Uploads a file for a lead (`insurance.lead` attachment entity) or imports it from a remote HTTPS URL. Requires `insurance.leads.manage` and `attachments.manage`.',
  methods: {
    POST: {
      summary: 'Attach file to lead',
      description:
        'Either send `multipart/form-data` with `file` (optional `tags` JSON string), or `application/json` with `sourceUrl` and optional `fileName`.',
      requestBody: {
        contentType: 'multipart/form-data | application/json',
        schema: z.union([
          z.object({
            file: z.string().describe('Binary upload'),
            tags: z.string().optional().describe('JSON array of tag strings'),
          }),
          jsonImportSchema,
        ]),
      },
      responses: [
        { status: 200, description: 'Attachment created', schema: okResponseSchema },
      ],
      errors: [
        { status: 400, description: 'Validation or import error', schema: errorSchema },
        { status: 401, description: 'Unauthorized', schema: errorSchema },
        { status: 404, description: 'Lead not found', schema: errorSchema },
        { status: 415, description: 'Unsupported media type', schema: errorSchema },
        { status: 502, description: 'Remote download failed', schema: errorSchema },
      ],
    },
  },
}
