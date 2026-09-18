import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { quoteBodySchema, type QuoteBodyInput } from '../../data/validators'
import { FLEET_QUOTE_ACCESS_FEATURES } from '../../lib/pricing/runFleetQuote'

type QuoteAuthScope = {
  em: EntityManager
  tenantId: string
  organizationId: string
  auth: { sub: string; tenantId: string; orgId?: string | null; isSuperAdmin?: boolean }
}

/**
 * Resolves org/tenant scope and checks any-of quote features
 * (pricing.quote | view | driver | trips.inject).
 */
export async function resolveFleetQuoteRequestScope(
  req: Request,
  body: QuoteBodyInput,
): Promise<QuoteAuthScope> {
  const auth = await getAuthFromRequest(req)
  if (!auth?.sub || !auth.tenantId || (!auth.orgId && !auth.isSuperAdmin)) {
    throw new CrudHttpError(401, { error: 'Unauthorized' })
  }

  const container = await createRequestContainer()
  const rbac = container.resolve('rbacService') as {
    userHasAnyFeature: (
      userId: string,
      candidates: string[],
      scope: { tenantId: string | null; organizationId: string | null },
    ) => Promise<boolean>
  }

  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  const organizationId = body.organizationId ?? scope?.selectedId ?? auth.orgId ?? null
  const tenantId = body.tenantId ?? auth.tenantId
  if (!organizationId || !tenantId) {
    throw new CrudHttpError(401, { error: 'Unauthorized' })
  }

  if (!auth.isSuperAdmin) {
    const allowed = await rbac.userHasAnyFeature(auth.sub, [...FLEET_QUOTE_ACCESS_FEATURES], {
      tenantId,
      organizationId,
    })
    if (!allowed) {
      throw new CrudHttpError(403, { error: 'Forbidden' })
    }
  }

  const em = container.resolve('em') as EntityManager
  return {
    em,
    tenantId,
    organizationId,
    auth: {
      sub: auth.sub,
      tenantId: auth.tenantId,
      orgId: auth.orgId ?? null,
      isSuperAdmin: auth.isSuperAdmin === true,
    },
  }
}

export function parseFleetQuoteBody(raw: unknown): QuoteBodyInput {
  const parsed = quoteBodySchema.safeParse(raw)
  if (!parsed.success) {
    throw new CrudHttpError(400, { error: parsed.error.flatten() })
  }
  return parsed.data
}
