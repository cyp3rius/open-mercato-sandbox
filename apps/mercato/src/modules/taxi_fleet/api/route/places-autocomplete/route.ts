import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { getOpenRouteServiceApiKey, orsGeocodeAutocomplete, type RouteLocale } from '@/modules/taxi_fleet/lib/route/openRouteService'
import {
  mapOrsFeaturesToSuggestions,
  readCachedPlaceSuggestions,
  writeCachedPlaceSuggestions,
  type PlaceSuggestion,
} from '@/modules/taxi_fleet/lib/route/placesAutocomplete'
import { routePlacesAutocompleteQuerySchema } from '@/modules/taxi_fleet/data/validators'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.view'] },
}

export async function GET(req: Request) {
  try {
    const auth = await getAuthFromRequest(req)
    if (!auth?.tenantId) throw new CrudHttpError(401, { error: 'Unauthorized' })

    const url = new URL(req.url)
    const parsed = routePlacesAutocompleteQuerySchema.parse({
      input: url.searchParams.get('input') ?? '',
      lang: url.searchParams.get('lang') ?? undefined,
      filter: url.searchParams.get('filter') ?? undefined,
    })

    if (parsed.input.length < 2) {
      return NextResponse.json({ suggestions: [] satisfies PlaceSuggestion[] })
    }

    if (!getOpenRouteServiceApiKey()) {
      throw new CrudHttpError(503, { error: 'OPENROUTESERVICE_API_KEY not configured' })
    }

    const locale: RouteLocale = parsed.lang
    const airportOnly = parsed.filter === 'airport'

    const cached = readCachedPlaceSuggestions(parsed.input, locale, airportOnly)
    if (cached) {
      return NextResponse.json({ suggestions: cached })
    }

    const { ok, data } = await orsGeocodeAutocomplete(parsed.input, locale, req.signal)
    if (!ok) {
      throw new CrudHttpError(502, { error: 'Geocoding service error', suggestions: [] })
    }

    const suggestions = mapOrsFeaturesToSuggestions(data.features ?? [], locale, airportOnly)
    writeCachedPlaceSuggestions(parsed.input, locale, airportOnly, suggestions)

    return NextResponse.json({ suggestions })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    if (err instanceof DOMException && err.name === 'AbortError') {
      return NextResponse.json({ suggestions: [] }, { status: 499 })
    }
    console.error('taxi_fleet.route.places-autocomplete failed', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('taxi_fleet.errors.generic', 'Operation failed.') }, { status: 500 })
  }
}

const suggestionSchema = z.object({
  id: z.string(),
  label: z.string(),
  lon: z.number().optional(),
  lat: z.number().optional(),
  isAirport: z.boolean().optional(),
})

export const openApi = {
  GET: {
    summary: 'Place autocomplete for trip route fields',
    tags: ['Taxi fleet'],
    parameters: [
      { name: 'input', in: 'query', required: true, schema: { type: 'string', minLength: 2 } },
      { name: 'lang', in: 'query', schema: { type: 'string', enum: ['pl', 'en'] } },
      { name: 'filter', in: 'query', schema: { type: 'string', enum: ['airport'] } },
    ],
    responses: {
      200: { schema: z.object({ suggestions: z.array(suggestionSchema) }) },
    },
  },
}
