import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { tripInjectSchema, type TripInjectInput } from '../../../../../data/validators'
import { STRAPI_TAXI_REQUEST_SOURCE } from '../../../../../lib/strapiTaxiRequestMapper'

export const metadata = {
  path: '/taxi_fleet/trips/inject',
  POST: {
    requireAuth: true,
    requireFeatures: ['taxi_fleet.trips.inject'],
  },
}

const strapiPayloadSchema = z.record(z.string(), z.unknown())

const injectBodySchema = z
  .object({
    organizationId: z.string().uuid(),
    tenantId: z.string().uuid(),
    externalId: z.string().trim().min(1).max(191),
    source: z.string().trim().min(1).max(120).optional(),
    payload: strapiPayloadSchema,
  })
  .strict()

const injectResponseSchema = z.object({
  id: z.string().uuid(),
  created: z.boolean(),
  requestId: z.string(),
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

export async function POST(req: Request) {
  try {
    const { ctx, translate } = await buildContext(req)
    const rawBody = await req.json().catch(() => ({}))
    const body = injectBodySchema.parse(rawBody)

    const injectInput = parseScopedCommandInput(
      tripInjectSchema,
      {
        organizationId: body.organizationId,
        tenantId: body.tenantId,
        externalId: body.externalId,
        source: body.source?.trim() || STRAPI_TAXI_REQUEST_SOURCE,
        payload: body.payload,
      },
      ctx,
      translate,
    ) as TripInjectInput

    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute<typeof injectInput, { tripId: string; created: boolean }>(
      'taxi_fleet.trips.inject',
      { input: injectInput, ctx },
    )
    const tripId = result?.tripId
    if (!tripId) {
      return NextResponse.json(
        { error: translate('taxi_fleet.trips.inject.error.createFailed', 'Failed to inject trip.') },
        { status: 400 },
      )
    }

    return NextResponse.json(
      {
        id: tripId,
        created: result?.created === true,
        requestId: body.externalId,
      },
      { status: result?.created ? 201 : 200 },
    )
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 })
    }
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    const { translate } = await resolveTranslations()
    console.error('[taxi_fleet/trips/inject] POST failed', err)
    return NextResponse.json(
      { error: translate('taxi_fleet.trips.inject.error.generic', 'Trip inject failed.') },
      { status: 500 },
    )
  }
}

const injectOpenBody = z.object({
  organizationId: z.string().uuid(),
  tenantId: z.string().uuid(),
  externalId: z.string(),
  source: z.string().optional(),
  payload: strapiPayloadSchema,
})

export const openApi: OpenApiRouteDoc = {
  tag: 'Taxi fleet',
  summary: 'Inject trip from Strapi taxi request',
  methods: {
    POST: {
      summary: 'Inject trip',
      description:
        'Accepts a Strapi `taxi-requests` payload (or calculator booking payload), maps it to an unscheduled fleet trip (`teamMemberId` / `resourceId` null, status `draft`), resolves CRM customer from contact, and stores the full Strapi snapshot in `metadata`. Idempotent by `externalId` (Strapi `requestId`). Authenticate with an API key granted `taxi_fleet.trips.inject`.',
      requestBody: {
        contentType: 'application/json',
        schema: injectOpenBody,
      },
      responses: [
        {
          status: 201,
          description: 'Trip created',
          schema: injectResponseSchema.extend({ created: z.literal(true) }),
        },
        {
          status: 200,
          description: 'Trip already exists',
          schema: injectResponseSchema.extend({ created: z.literal(false) }),
        },
      ],
      errors: [
        { status: 400, description: 'Validation error', schema: z.object({ error: z.unknown() }) },
        { status: 401, description: 'Unauthorized', schema: z.object({ error: z.string() }) },
        { status: 403, description: 'Forbidden', schema: z.object({ error: z.string() }) },
      ],
    },
  },
}

export default POST
