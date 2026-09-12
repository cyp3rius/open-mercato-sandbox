import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { getOpenRouteServiceApiKey, type RouteLocale } from '@/modules/taxi_fleet/lib/route/openRouteService'
import {
  buildRouteDistanceResponse,
  computeRouteDistance,
  normalizeRouteDistanceStops,
} from '@/modules/taxi_fleet/lib/route/routeDistance'
import { routeDistanceBodySchema } from '@/modules/taxi_fleet/data/validators'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['taxi_fleet.view'] },
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthFromRequest(req)
    if (!auth?.tenantId) throw new CrudHttpError(401, { error: 'Unauthorized' })

    if (!getOpenRouteServiceApiKey()) {
      throw new CrudHttpError(503, { error: 'OPENROUTESERVICE_API_KEY not configured' })
    }

    let body: Record<string, unknown>
    const parsedBody = routeDistanceBodySchema.safeParse(await req.json())
    if (!parsedBody.success) {
      throw new CrudHttpError(400, { error: 'Invalid JSON' })
    }
    body = parsedBody.data

    const stops = normalizeRouteDistanceStops(body)
    if (!stops) {
      throw new CrudHttpError(400, { error: 'Missing route stops' })
    }

    const locale: RouteLocale = body.lang === 'en' ? 'en' : 'pl'
    const route = await computeRouteDistance(stops, locale)

    if (!route) {
      if (process.env.NODE_ENV === 'development') {
        const km = 50
        return NextResponse.json({
          distanceKm: km,
          distanceText: `~${km} km`,
          durationText: '1 h 0 min',
          durationSeconds: 3600,
          devFallback: true,
        })
      }
      throw new CrudHttpError(422, { error: 'Route not found' })
    }

    return NextResponse.json(buildRouteDistanceResponse(route))
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('taxi_fleet.route.distance failed', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('taxi_fleet.errors.generic', 'Operation failed.') }, { status: 500 })
  }
}

export const openApi = {
  POST: {
    summary: 'Calculate driving distance and duration for trip route stops',
    tags: ['Taxi fleet'],
    requestBody: {
      schema: routeDistanceBodySchema,
    },
    responses: {
      200: {
        schema: z.object({
          distanceKm: z.number(),
          distanceText: z.string(),
          durationText: z.string(),
          durationSeconds: z.number().optional(),
          devFallback: z.boolean().optional(),
        }),
      },
    },
  },
}
