import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandRuntimeContext, CommandBus } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['catalog.customer_offerings.manage'] },
}

export const openApi = {
  tags: ['Catalog'],
  summary: 'Deactivate a customer product offering',
}

const bodySchema = z.object({
  offeringId: z.string().uuid(),
})

async function buildContext(req: Request): Promise<CommandRuntimeContext> {
  const container = await createRequestContainer()
  const auth = await getAuthFromRequest(req)
  if (!auth) throw new CrudHttpError(401, { error: 'Unauthorized' })
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  return {
    container,
    auth,
    organizationScope: scope,
    selectedOrganizationId: scope?.selectedId ?? auth.orgId ?? null,
    organizationIds: scope?.filterIds ?? (auth.orgId ? [auth.orgId] : null),
    request: req,
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await buildContext(req)
    const raw = await req.json().catch(() => ({}))
    const parsed = bodySchema.parse(raw)
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute('catalog.customer_offerings.deactivate', {
      input: {
        offeringId: parsed.offeringId,
        tenantId: ctx.auth?.tenantId,
        organizationId: ctx.selectedOrganizationId ?? ctx.auth?.orgId,
      },
      ctx,
    })
    return NextResponse.json({ ok: true, ...(result ?? {}) })
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    const { translate } = await resolveTranslations()
    console.error('catalog.customer_offerings.deactivate failed', err)
    return NextResponse.json(
      {
        error: translate(
          'catalog.customerOfferings.errors.deactivate',
          'Failed to deactivate offering.',
        ),
      },
      { status: 400 },
    )
  }
}
