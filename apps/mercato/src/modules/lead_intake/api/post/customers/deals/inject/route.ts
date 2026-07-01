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
  dealCreateSchema,
  commentCreateSchema,
  type DealCreateInput,
  type CommentCreateInput,
} from '@open-mercato/core/modules/customers/data/validators'
import { CustomerDeal } from '@open-mercato/core/modules/customers/data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { resolveReferringPartnerEntityId } from '../../../../../../insurance_desk/lib/resolveReferringPartner'
import { resolveOrCreateContactPerson } from '../../../../../../insurance_desk/lib/resolveContactPerson'
import {
  buildDealDescription,
  buildDealPayloadForStorage,
  deriveDealTitle,
  mapContactToPersonFields,
  mapStrapiPayloadForDealInject,
  STRAPI_DEAL_SOURCE,
} from '../../../../../lib/strapiDealInject'
import { resolveWebsitePipelineForDeal } from '../../../../../lib/resolveWebsitePipeline'
import { notifyInjectFeatureUsers } from '../../../../../lib/notifyInjectFeatureUsers'
import {
  LEAD_INTAKE_DEAL_INJECT_NOTIFY_FEATURE,
  notificationTypes as leadIntakeNotificationTypes,
} from '../../../../../notifications'

export const metadata = {
  path: '/customers/deals/inject',
  POST: {
    requireAuth: true,
    requireFeatures: ['lead_intake.deals.inject'],
  },
}

const strapiPayloadSchema = z.record(z.string(), z.unknown())

const injectBodySchema = z
  .object({
    organizationId: z.string().uuid(),
    tenantId: z.string().uuid(),
    title: z.string().trim().min(1).max(500),
    source: z.string().trim().min(1).max(120).optional(),
    externalId: z.string().trim().min(1).max(191),
    payload: strapiPayloadSchema,
  })
  .strict()

const injectResponseSchema = z.object({
  id: z.string().uuid(),
  created: z.boolean(),
  personEntityId: z.string().uuid().nullable(),
  referringPartnerEntityId: z.string().uuid().nullable(),
  commentId: z.string().uuid().nullable(),
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

async function findExistingDeal(
  em: EntityManager,
  params: { organizationId: string; tenantId: string; externalId: string },
): Promise<CustomerDeal | null> {
  return em.findOne(CustomerDeal, {
    organizationId: params.organizationId,
    tenantId: params.tenantId,
    externalId: params.externalId,
    deletedAt: null,
  })
}

function buildInjectResponse(params: {
  id: string
  created: boolean
  personEntityId: string | null
  referringPartnerEntityId: string | null
  commentId: string | null
}) {
  return NextResponse.json(
    {
      id: params.id,
      created: params.created,
      personEntityId: params.personEntityId,
      referringPartnerEntityId: params.referringPartnerEntityId,
      commentId: params.commentId,
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
    const existing = await findExistingDeal(em, {
      organizationId: body.organizationId,
      tenantId: body.tenantId,
      externalId: body.externalId,
    })
    if (existing) {
      return buildInjectResponse({
        id: existing.id,
        created: false,
        personEntityId: null,
        referringPartnerEntityId: existing.referringPartnerEntityId ?? null,
        commentId: null,
      })
    }

    const mapped = mapStrapiPayloadForDealInject(body.payload)
    const source = body.source?.trim() || STRAPI_DEAL_SOURCE
    let referringPartnerEntityId: string | null = null
    if (mapped.referralCode) {
      referringPartnerEntityId = await resolveReferringPartnerEntityId(ctx, translate, {
        organizationId: body.organizationId,
        tenantId: body.tenantId,
        referralCode: mapped.referralCode,
        ownerDisplayName: mapped.referralOwnerName ?? mapped.referralCode,
        source,
      })
    }

    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    let personEntityId: string | null = null
    const personFields = mapContactToPersonFields(mapped.payload.contact, source)
    if (personFields) {
      personEntityId = await resolveOrCreateContactPerson(ctx, translate, {
        organizationId: body.organizationId,
        tenantId: body.tenantId,
        personFields,
        preferEntityId: referringPartnerEntityId,
      })
    }

    const dealTitle = deriveDealTitle(body.title, mapped.payload)
    const websitePipeline = await resolveWebsitePipelineForDeal(em, {
      organizationId: body.organizationId,
      tenantId: body.tenantId,
    })
    const dealInput = parseScopedCommandInput(
      dealCreateSchema,
      {
        organizationId: body.organizationId,
        tenantId: body.tenantId,
        title: dealTitle.length > 200 ? dealTitle.slice(0, 200) : dealTitle,
        description: buildDealDescription(mapped.payload),
        status: 'open',
        source,
        externalId: body.externalId,
        payload: buildDealPayloadForStorage(mapped.payload),
        referringPartnerEntityId,
        personIds: personEntityId ? [personEntityId] : [],
        ...(websitePipeline ? { pipelineId: websitePipeline.pipelineId } : {}),
      },
      ctx,
      translate,
    ) as DealCreateInput & { customFields?: Record<string, unknown> }

    const { result: dealResult } = await commandBus.execute<typeof dealInput, { dealId: string }>(
      'customers.deals.create',
      { input: dealInput, ctx },
    )
    const dealId = dealResult?.dealId
    if (!dealId) {
      return NextResponse.json(
        { error: translate('lead_intake.deals.inject.error.createFailed', 'Failed to create deal.') },
        { status: 400 },
      )
    }

    let commentId: string | null = null
    const description = buildDealDescription(mapped.payload)
    if (personEntityId && description) {
      const commentInput = parseScopedCommandInput(
        commentCreateSchema,
        {
          organizationId: body.organizationId,
          tenantId: body.tenantId,
          entityId: personEntityId,
          dealId,
          body: description,
        },
        ctx,
        translate,
      ) as CommentCreateInput & { customFields?: Record<string, unknown> }
      const { result: commentResult } = await commandBus.execute<typeof commentInput, { commentId: string }>(
        'customers.comments.create',
        { input: commentInput, ctx },
      )
      commentId = commentResult?.commentId ?? null
    }

    await notifyInjectFeatureUsers(ctx.container, {
      notificationTypes: leadIntakeNotificationTypes,
      notificationType: 'lead_intake.deal.injected',
      requiredFeature: LEAD_INTAKE_DEAL_INJECT_NOTIFY_FEATURE,
      tenantId: body.tenantId,
      organizationId: body.organizationId,
      titleVariables: { title: dealTitle },
      bodyVariables: {
        source,
        externalId: body.externalId,
      },
      sourceEntityType: 'customers:deal',
      sourceEntityId: dealId,
      linkHref: `/backend/customers/deals/${dealId}`,
      logLabel: 'customers/deals/inject',
    })

    return buildInjectResponse({
      id: dealId,
      created: true,
      personEntityId,
      referringPartnerEntityId,
      commentId,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 })
    }
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    const { translate } = await resolveTranslations()
    console.error('[customers/deals/inject] POST failed', err)
    return NextResponse.json(
      { error: translate('lead_intake.deals.inject.error.generic', 'Deal inject failed.') },
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
})

export const openApi: OpenApiRouteDoc = {
  tag: 'Lead intake',
  summary: 'Inject CRM deal from external channel (Strapi)',
  methods: {
    POST: {
      summary: 'Inject deal',
      description:
        'Parses a Strapi payload (cooperation form or insurance wizard), resolves the referring partner, creates a CRM person when contact data is present, and opens a deal linked to that person. Response uses `id` like `POST /api/customers/deals`. Requires API key with `lead_intake.deals.inject`.',
      requestBody: {
        contentType: 'application/json',
        schema: injectOpenBody,
      },
      responses: [
        {
          status: 201,
          description: 'Deal created',
          schema: injectResponseSchema.extend({ created: z.literal(true) }),
        },
        {
          status: 200,
          description: 'Deal already exists (idempotent by externalId)',
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
