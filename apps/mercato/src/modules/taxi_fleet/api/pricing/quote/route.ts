import { NextResponse } from 'next/server'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import {
  parseFleetQuoteBody,
  QuoteValidationError,
  resolveFleetQuoteRequestScope,
  runFleetQuote,
} from '@/modules/taxi_fleet/lib/pricing'
import { quoteBodySchema, quoteResponseSchema } from '@/modules/taxi_fleet/data/validators'

export const metadata = {
  POST: { requireAuth: true },
}

export async function POST(req: Request) {
  try {
    const body = parseFleetQuoteBody(await req.json())
    const scope = await resolveFleetQuoteRequestScope(req, body)
    const quote = await runFleetQuote(scope.em, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    }, body)
    return NextResponse.json(quote)
  } catch (err) {
    if (err instanceof QuoteValidationError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 })
    }
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('taxi_fleet.pricing.quote failed', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('taxi_fleet.errors.generic', 'Operation failed.') }, { status: 500 })
  }
}

export const openApi = {
  POST: {
    summary: 'Calculate fleet trip quote (canonical)',
    description:
      'Canonical pricing endpoint for CRM trip forms, the driver app, and future external calculators (e.g. Strapi inject). Uses organization taxi fleet pricing settings. Requires session auth and any of: taxi_fleet.view, taxi_fleet.driver, taxi_fleet.trips.inject. Legacy alias: POST /api/taxi_fleet/quote.',
    tags: ['Taxi fleet pricing'],
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
