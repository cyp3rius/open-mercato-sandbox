import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { withScopedPayload } from '../../utils'

const convertSchema = z.object({
  dealId: z.string().uuid(),
  currencyCode: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/)
    .optional(),
})

export const metadata = {
  POST: {
    requireAuth: true,
    requireAnyFeatures: [
      'customers.deals.manage',
      'customers.simple_deals.manage',
      'sales.quotes.manage',
      'sales.simple_quotes.manage',
    ],
  },
}

async function resolveRequestContext(req: Request): Promise<CommandRuntimeContext> {
  const container = await createRequestContainer()
  const auth = await getAuthFromRequest(req)
  const { translate } = await resolveTranslations()
  if (!auth || !auth.tenantId) {
    throw new CrudHttpError(401, {
      error: translate('customers.simpleDeals.errors.unauthorized', 'Unauthorized'),
    })
  }
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  const organizationId = scope?.selectedId ?? auth.orgId ?? null
  if (!organizationId) {
    throw new CrudHttpError(400, {
      error: translate(
        'customers.simpleDeals.errors.organizationRequired',
        'Organization context is required',
      ),
    })
  }
  return {
    container,
    auth,
    organizationScope: scope,
    selectedOrganizationId: organizationId,
    organizationIds: scope?.filterIds ?? (auth.orgId ? [auth.orgId] : null),
    request: req,
  }
}

async function assertConvertFeatures(
  ctx: CommandRuntimeContext,
  translate: (key: string, fallback?: string) => string,
) {
  const auth = ctx.auth
  if (!auth?.sub || !auth.tenantId) {
    throw new CrudHttpError(401, {
      error: translate('customers.simpleDeals.errors.unauthorized', 'Unauthorized'),
    })
  }
  const rbac = ctx.container.resolve('rbacService') as {
    userHasAnyFeature: (
      userId: string,
      features: string[],
      scope: { tenantId: string | null; organizationId: string | null },
    ) => Promise<boolean>
  }
  const organizationId = ctx.selectedOrganizationId ?? auth.orgId ?? null
  const scope = { tenantId: auth.tenantId, organizationId }
  const canDeal = await rbac.userHasAnyFeature(
    auth.sub,
    ['customers.deals.manage', 'customers.simple_deals.manage'],
    scope,
  )
  const canQuote = await rbac.userHasAnyFeature(
    auth.sub,
    ['sales.quotes.manage', 'sales.simple_quotes.manage'],
    scope,
  )
  if (!canDeal || !canQuote) {
    throw new CrudHttpError(403, {
      error: translate('customers.simpleDeals.errors.forbidden', 'Forbidden'),
    })
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await resolveRequestContext(req)
    const { translate } = await resolveTranslations()
    await assertConvertFeatures(ctx, translate)
    const payload = await req.json().catch(() => ({}))
    const scoped = withScopedPayload(payload ?? {}, ctx, translate)
    const input = convertSchema.parse(scoped)
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute<
      {
        dealId: string
        organizationId: string
        tenantId: string
        currencyCode?: string
      },
      { quoteId: string; dealId: string }
    >('customers.deals.convert_to_quote', {
      input: {
        dealId: input.dealId,
        organizationId: ctx.selectedOrganizationId!,
        tenantId: ctx.auth!.tenantId!,
        currencyCode: input.currencyCode,
      },
      ctx,
    })
    return NextResponse.json({
      quoteId: result?.quoteId,
      dealId: result?.dealId ?? input.dealId,
    })
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    const { translate } = await resolveTranslations()
    console.error('customers.deals.convert-to-quote failed', err)
    return NextResponse.json(
      {
        error: translate(
          'customers.simpleDeals.errors.convertFailed',
          'Failed to convert deal to quote.',
        ),
      },
      { status: 400 },
    )
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Customers',
  summary: 'Convert deal to sales quote',
  methods: {
    POST: {
      summary: 'Create a draft quote from a deal (header only)',
      requestBody: {
        contentType: 'application/json',
        schema: convertSchema,
      },
      responses: [
        {
          status: 200,
          description: 'Quote created',
          schema: z.object({ quoteId: z.string().uuid(), dealId: z.string().uuid() }),
        },
        { status: 400, description: 'Invalid payload', schema: z.object({ error: z.string() }) },
        { status: 401, description: 'Unauthorized', schema: z.object({ error: z.string() }) },
        { status: 403, description: 'Forbidden', schema: z.object({ error: z.string() }) },
      ],
    },
  },
}
