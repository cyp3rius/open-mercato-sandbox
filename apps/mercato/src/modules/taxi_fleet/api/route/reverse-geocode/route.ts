import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { RouteLocale } from '@/modules/taxi_fleet/lib/route/openRouteService'
import { reverseGeocodeCoordinates } from '@/modules/taxi_fleet/lib/route/reverseGeocode'
import { routeReverseGeocodeQuerySchema } from '@/modules/taxi_fleet/data/validators'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.view'] },
}

export async function GET(req: Request) {
  try {
    const auth = await getAuthFromRequest(req)
    if (!auth?.tenantId) throw new CrudHttpError(401, { error: 'Unauthorized' })

    const url = new URL(req.url)
    const parsed = routeReverseGeocodeQuerySchema.parse({
      lat: url.searchParams.get('lat'),
      lng: url.searchParams.get('lng'),
      lang: url.searchParams.get('lang') ?? undefined,
    })

    const locale: RouteLocale = parsed.lang
    const result = await reverseGeocodeCoordinates(parsed.lat, parsed.lng, locale)
    if (!result) {
      throw new CrudHttpError(422, { error: 'Address not found' })
    }

    return NextResponse.json({
      address: result.address,
      lat: parsed.lat,
      lng: parsed.lng,
      source: result.source,
    })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('taxi_fleet.route.reverse-geocode failed', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('taxi_fleet.errors.generic', 'Operation failed.') }, { status: 500 })
  }
}

export const openApi = {
  GET: {
    summary: 'Reverse geocode coordinates to an address label',
    tags: ['Taxi fleet'],
    parameters: [
      { name: 'lat', in: 'query', required: true, schema: { type: 'number' } },
      { name: 'lng', in: 'query', required: true, schema: { type: 'number' } },
      { name: 'lang', in: 'query', schema: { type: 'string', enum: ['pl', 'en'] } },
    ],
    responses: {
      200: {
        schema: z.object({
          address: z.string(),
          lat: z.number(),
          lng: z.number(),
          source: z.enum(['ors', 'nominatim']),
        }),
      },
    },
  },
}
