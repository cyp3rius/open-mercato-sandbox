import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { assignmentSelfStartSchema } from '@/modules/taxi_fleet/data/validators'
import { buildDriverApiContext } from '@/modules/taxi_fleet/lib/driverApiContext'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['taxi_fleet.driver'] },
}

export async function POST(req: Request) {
  try {
    const context = await buildDriverApiContext(req)
    const { translate } = await resolveTranslations()
    const body = await req.json().catch(() => ({}))
    const parsed = assignmentSelfStartSchema.parse(body)
    const commandBus = context.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute<
      typeof parsed,
      {
        assignmentId: string
        shiftStart: string | null
        shiftEnd: string | null
        plannedShiftStart: string | null
        plannedShiftEnd: string | null
        gpsDistanceKm: string | null
        status: string
        resourceId: string
      }
    >('taxi_fleet.assignments.self_start', { input: parsed, ctx: context })
    if (!result?.assignmentId) {
      return NextResponse.json(
        { error: translate('taxi_fleet.errors.shiftFailed', 'Failed to update shift.') },
        { status: 400 },
      )
    }
    return NextResponse.json({
      id: result.assignmentId,
      resourceId: result.resourceId,
      shiftStart: result.shiftStart,
      shiftEnd: result.shiftEnd,
      plannedShiftStart: result.plannedShiftStart,
      plannedShiftEnd: result.plannedShiftEnd,
      gpsDistanceKm: result.gpsDistanceKm,
      status: result.status,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 })
    }
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('[taxi_fleet/driver/assignments/start] POST failed', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const openApi = {
  POST: {
    summary: 'Start today’s shift ad-hoc (or clock in when an assignment already exists)',
    tags: ['Taxi fleet driver'],
    requestBody: { schema: assignmentSelfStartSchema },
  },
}

export default POST
