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
import {
  tripInjectLegacyEnvelopeSchema,
  tripInjectSchema,
  type TripInjectInput,
} from '../../../../../data/validators'
import { STRAPI_TAXI_REQUEST_SOURCE } from '../../../../../lib/strapiTaxiRequestMapper'
import {
  isLegacyTripInjectEnvelope,
  toNativeTripInjectInputFromLegacyPayload,
} from '../../../../../lib/tripInjectNative'

export const metadata = {
  path: '/taxi_fleet/trips/inject',
  POST: {
    requireAuth: true,
    requireFeatures: ['taxi_fleet.trips.inject'],
  },
}

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

function normalizeInjectBody(rawBody: unknown): Record<string, unknown> {
  if (isLegacyTripInjectEnvelope(rawBody)) {
    const envelope = tripInjectLegacyEnvelopeSchema.parse(rawBody)
    return toNativeTripInjectInputFromLegacyPayload({
      organizationId: envelope.organizationId,
      tenantId: envelope.tenantId,
      externalId: envelope.externalId,
      source: envelope.source?.trim() || STRAPI_TAXI_REQUEST_SOURCE,
      payload: envelope.payload,
    })
  }
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    return {}
  }
  return rawBody as Record<string, unknown>
}

export async function POST(req: Request) {
  try {
    const { ctx, translate } = await buildContext(req)
    const rawBody = await req.json().catch(() => ({}))
    const nativeBody = normalizeInjectBody(rawBody)

    const injectInput = parseScopedCommandInput(tripInjectSchema, nativeBody, ctx, translate) as TripInjectInput

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
        requestId: injectInput.externalId,
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

const injectOpenBody = tripInjectSchema

export const openApi: OpenApiRouteDoc = {
  tag: 'Taxi fleet',
  summary: 'Inject trip (native or legacy transporter payload)',
  methods: {
    POST: {
      summary: 'Inject trip',
      description:
        'Dual-mode inject. Native body: trip fields plus either CRM customer UUID (`customerPersonId` / `customerCompanyId` / `customerEntityId`) or plain contact fields (creates/ensures CRM customer). Legacy transporter envelope `{ externalId, payload }` (e.g. Strapi) is adapted to the native contract. Idempotent by `externalId` (`metadata.requestId`). Creates an unscheduled fleet trip (`teamMemberId` / `resourceId` null, status `new`). Requires `taxi_fleet.trips.inject`.',
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
