import { NextResponse } from 'next/server'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import {
  discountCodeValidateQuerySchema,
  discountCodeValidateResponseSchema,
} from '../../../data/validators'
import { validateDiscountCode } from '../../../lib/discountCodes'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.trips.inject'] },
}

export async function GET(req: Request) {
  try {
    const container = await createRequestContainer()
    const auth = await getAuthFromRequest(req)
    const { translate } = await resolveTranslations()
    if (!auth) throw new CrudHttpError(401, { error: translate('errors.unauthorized', 'Unauthorized') })

    const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const organizationId = scope?.selectedId ?? auth.orgId ?? null
    const tenantId = auth.tenantId ?? null
    if (!organizationId || !tenantId) {
      throw new CrudHttpError(400, { error: translate('errors.badRequest', 'Bad request') })
    }

    const url = new URL(req.url)
    const query = discountCodeValidateQuerySchema.parse({
      code: url.searchParams.get('code') ?? '',
      totalPrice: url.searchParams.get('totalPrice') ?? url.searchParams.get('total_price') ?? '0',
    })

    const em = container.resolve('em') as EntityManager
    const result = await validateDiscountCode(
      em,
      { tenantId, organizationId },
      query.code,
      query.totalPrice,
    )
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('taxi_fleet.discount_codes.validate failed', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('taxi_fleet.errors.generic', 'Operation failed.') }, { status: 500 })
  }
}

export const openApi = {
  GET: {
    summary: 'Validate discount code against trip total',
    description:
      'Used by external trip inject channels (e.g. Strapi). Requires taxi_fleet.trips.inject (API key friendly).',
    tags: ['Taxi fleet'],
    responses: { 200: { schema: discountCodeValidateResponseSchema } },
  },
}
