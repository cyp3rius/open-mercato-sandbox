import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandRuntimeContext, CommandBus } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import {
  insuranceLeadCreateSchema,
  type InsuranceLeadCreateInput,
} from '@open-mercato/core/modules/insurance/data/validators'
import { InsuranceLead } from '@open-mercato/core/modules/insurance/data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { mapStrapiPayloadToInsuranceLead, STRAPI_LEAD_SOURCE } from '../../../../../lib/strapiLeadMapper'
import { resolveReferringPartnerEntityId } from '../../../../../lib/resolveReferringPartner'
import {
  collectLeadAttachmentInputs,
  importAttachmentsForLead,
} from '../../../../../lib/importLeadAttachments'

export const metadata = {
  path: '/insurance/leads/inject',
  POST: {
    requireAuth: true,
    requireFeatures: ['insurance_desk.leads.inject'],
  },
}

const attachmentInputSchema = z
  .object({
    sourceUrl: z.string().url().optional(),
    url: z.string().url().optional(),
    fileName: z.string().trim().min(1).max(512).optional(),
    name: z.string().trim().min(1).max(512).optional(),
    tags: z.array(z.string()).optional(),
  })
  .refine((value) => Boolean(value.sourceUrl || value.url), {
    message: 'sourceUrl or url is required',
  })

const strapiPayloadSchema = z.record(z.string(), z.unknown())

const injectBodySchema = z
  .object({
    organizationId: z.string().uuid(),
    tenantId: z.string().uuid(),
    title: z.string().trim().min(1).max(500),
    source: z.string().trim().min(1).max(120).optional(),
    externalId: z.string().trim().min(1).max(191),
    payload: strapiPayloadSchema,
    attachments: z.array(attachmentInputSchema).optional(),
  })
  .strict()

const attachmentResponseSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string(),
  url: z.string(),
})

const injectResponseSchema = z.object({
  id: z.string().uuid(),
  created: z.boolean(),
  referringPartnerEntityId: z.string().uuid().nullable(),
  attachments: z.array(attachmentResponseSchema),
  attachmentErrors: z.array(z.object({ sourceUrl: z.string(), error: z.string() })).optional(),
})

async function buildContext(
  req: Request,
): Promise<{ ctx: CommandRuntimeContext; translate: (key: string, fallback?: string) => string }> {
  const container = await createRequestContainer()
  const auth = await getAuthFromRequest(req)
  const { translate } = await resolveTranslations()
  if (!auth) throw new CrudHttpError(401, { error: translate('errors.unauthorized', 'Unauthorized') })
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  const ctx: CommandRuntimeContext = {
    container,
    auth,
    organizationScope: scope,
    selectedOrganizationId: scope?.selectedId ?? auth.orgId ?? null,
    organizationIds: scope?.filterIds ?? (auth.orgId ? [auth.orgId] : null),
    request: req,
  }
  return { ctx, translate }
}

async function findExistingLead(
  em: EntityManager,
  params: { organizationId: string; tenantId: string; externalId: string },
): Promise<InsuranceLead | null> {
  return em.findOne(InsuranceLead, {
    organizationId: params.organizationId,
    tenantId: params.tenantId,
    externalId: params.externalId,
    deletedAt: null,
  })
}

function buildInjectResponse(params: {
  id: string
  created: boolean
  referringPartnerEntityId: string | null
  attachments: Array<{ id: string; fileName: string; url: string }>
  attachmentErrors?: Array<{ sourceUrl: string; error: string }>
}) {
  return NextResponse.json(
    {
      id: params.id,
      created: params.created,
      referringPartnerEntityId: params.referringPartnerEntityId,
      attachments: params.attachments,
      ...(params.attachmentErrors?.length ? { attachmentErrors: params.attachmentErrors } : {}),
    },
    { status: params.created ? 201 : 200 },
  )
}

export async function POST(req: Request) {
  try {
    const { ctx, translate } = await buildContext(req)
    const rawBody = await req.json().catch(() => ({}))
    const body = injectBodySchema.parse(rawBody)

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const existing = await findExistingLead(em, {
      organizationId: body.organizationId,
      tenantId: body.tenantId,
      externalId: body.externalId,
    })
    if (existing) {
      return buildInjectResponse({
        id: existing.id,
        created: false,
        referringPartnerEntityId: existing.referringPartnerEntityId ?? null,
        attachments: [],
      })
    }

    const mapped = mapStrapiPayloadToInsuranceLead(body.payload)
    let referringPartnerEntityId: string | null = null
    if (mapped.referralCode) {
      referringPartnerEntityId = await resolveReferringPartnerEntityId(ctx, translate, {
        organizationId: body.organizationId,
        tenantId: body.tenantId,
        referralCode: mapped.referralCode,
        ownerDisplayName: mapped.referralOwnerName ?? mapped.referralCode,
        source: body.source?.trim() || STRAPI_LEAD_SOURCE,
      })
    }

    const leadInput = parseScopedCommandInput(
      insuranceLeadCreateSchema,
      {
        organizationId: body.organizationId,
        tenantId: body.tenantId,
        title: body.title,
        source: body.source?.trim() || STRAPI_LEAD_SOURCE,
        externalId: body.externalId,
        payload: mapped.payload,
        referringPartnerEntityId,
        status: 'received',
      },
      ctx,
      translate,
    ) as InsuranceLeadCreateInput & { customFields?: Record<string, unknown> }

    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute<typeof leadInput, { leadId: string }>('insurance.leads.create', {
      input: leadInput,
      ctx,
    })
    const leadId = result?.leadId
    if (!leadId) {
      return NextResponse.json(
        { error: translate('insurance_desk.leads.inject.error.createFailed', 'Failed to create insurance lead.') },
        { status: 400 },
      )
    }

    const attachmentInputs = collectLeadAttachmentInputs(body.attachments, body.payload)
    const { imported, errors } = await importAttachmentsForLead(ctx, {
      organizationId: body.organizationId,
      tenantId: body.tenantId,
      leadId,
      attachments: attachmentInputs,
    })

    return buildInjectResponse({
      id: leadId,
      created: true,
      referringPartnerEntityId,
      attachments: imported,
      attachmentErrors: errors,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 })
    }
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    const { translate } = await resolveTranslations()
    console.error('[insurance/leads/inject] POST failed', err)
    return NextResponse.json(
      { error: translate('insurance_desk.leads.inject.error.generic', 'Lead inject failed.') },
      { status: 500 },
    )
  }
}

const injectOpenBody = z.object({
  organizationId: z.string().uuid(),
  tenantId: z.string().uuid(),
  title: z.string(),
  source: z.string().optional(),
  externalId: z.string(),
  payload: z.record(z.string(), z.unknown()),
  attachments: z.array(attachmentInputSchema).optional(),
})

export const openApi: OpenApiRouteDoc = {
  tag: 'Insurance desk',
  summary: 'Inject insurance lead from external channel (Strapi)',
  methods: {
    POST: {
      summary: 'Inject lead',
      description:
        'Accepts a Strapi insurance inquiry payload, maps it to Open Mercato lead format, resolves the referring partner by referral code (creating a partner record when missing), creates the lead, and imports remote attachments (same storage as `POST /api/insurance/leads/{id}/attachments`). Response uses `id` like `POST /api/insurance/leads`. Authenticate with an API key scoped to the target tenant/organization and granted `insurance_desk.leads.inject`.',
      requestBody: {
        contentType: 'application/json',
        schema: injectOpenBody,
      },
      responses: [
        {
          status: 201,
          description: 'Lead created',
          schema: injectResponseSchema.extend({ created: z.literal(true) }),
        },
        {
          status: 200,
          description: 'Lead already exists (idempotent by externalId)',
          schema: injectResponseSchema.extend({ created: z.literal(false) }),
        },
      ],
      errors: [
        { status: 400, description: 'Validation error', schema: z.object({ error: z.unknown() }) },
        { status: 401, description: 'Unauthorized', schema: z.object({ error: z.string() }) },
        { status: 403, description: 'Forbidden', schema: z.object({ error: z.string() }) },
        { status: 409, description: 'Referral code conflict', schema: z.object({ error: z.string() }) },
      ],
    },
  },
}

export default POST
