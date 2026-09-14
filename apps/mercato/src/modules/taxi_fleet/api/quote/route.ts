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

/**
 * Legacy alias for POST /api/taxi_fleet/pricing/quote (same body/response contract).
 */
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
    console.error('taxi_fleet.quote failed', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('taxi_fleet.errors.generic', 'Operation failed.') }, { status: 500 })
  }
}

export const openApi = {
  POST: {
    summary: 'Calculate trip quote from fleet pricing configuration (legacy alias)',
    description:
      'Backward-compatible alias of POST /api/taxi_fleet/pricing/quote. Prefer the canonical /pricing/quote path for new clients.',
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
