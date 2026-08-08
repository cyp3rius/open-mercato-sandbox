import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { loadTaxiFleetOrganizationSettings } from '@/modules/taxi_fleet/lib/taxiFleetOrganizationSettings'
import {
  calculateQuote,
  isPublicHolidayPl,
  QuoteValidationError,
  resolveFleetPricingConfig,
} from '@/modules/taxi_fleet/lib/pricing'
import { quoteBodySchema, quoteResponseSchema } from '@/modules/taxi_fleet/data/validators'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['taxi_fleet.view'] },
}

async function resolveQuoteScope(req: Request, body: z.infer<typeof quoteBodySchema>) {
  const auth = await getAuthFromRequest(req)
  if (!auth?.tenantId || (!auth.orgId && !auth.isSuperAdmin)) {
    return null
  }
  const container = await createRequestContainer()
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  const organizationId = body.organizationId ?? scope?.selectedId ?? auth.orgId ?? null
  const tenantId = body.tenantId ?? auth.tenantId
  if (!organizationId || !tenantId) return null
  const em = container.resolve('em') as EntityManager
  return { em, tenantId, organizationId }
}

export async function POST(req: Request) {
  try {
    const parsed = quoteBodySchema.safeParse(await req.json())
    if (!parsed.success) {
      throw new CrudHttpError(400, { error: parsed.error.flatten() })
    }

    const scope = await resolveQuoteScope(req, parsed.data)
    if (!scope) {
      throw new CrudHttpError(401, { error: 'Unauthorized' })
    }

    const settings = await loadTaxiFleetOrganizationSettings(scope.em, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    })
    const pricingConfig = resolveFleetPricingConfig(settings)

    let isPublicHoliday = parsed.data.isPublicHoliday
    if (isPublicHoliday === undefined) {
      isPublicHoliday = await isPublicHolidayPl(parsed.data.date)
    }

    const quote = calculateQuote(
      {
        serviceType: parsed.data.serviceType,
        passengers: parsed.data.passengers,
        distanceKm: parsed.data.distanceKm,
        date: parsed.data.date,
        time: parsed.data.time,
        handLuggage: parsed.data.handLuggage,
        holdLuggage: parsed.data.holdLuggage,
        childSeats: parsed.data.childSeats,
        boosterSeats: parsed.data.boosterSeats,
        meetAndGreet: parsed.data.meetAndGreet,
        englishSpeakingDriver: parsed.data.englishSpeakingDriver,
        isPublicHoliday,
        vehicleCategory: parsed.data.vehicleCategory,
      },
      pricingConfig,
    )

    return NextResponse.json({
      currency: pricingConfig.currency,
      ...quote,
    })
  } catch (err) {
    if (err instanceof QuoteValidationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 })
    }
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('taxi_fleet.quote failed', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('taxi_fleet.errors.generic', 'Operation failed.') }, { status: 500 })
  }
}

export const openApi = {
  POST: {
    summary: 'Calculate trip quote from fleet pricing configuration',
    description:
      'Uses organization taxi fleet pricing settings (tariffs and surcharges). Intended for backend trip forms and future public calculator integration.',
    tags: ['Taxi fleet'],
    requestBody: {
      schema: quoteBodySchema,
    },
    responses: {
      200: {
        schema: quoteResponseSchema,
      },
    },
  },
}
