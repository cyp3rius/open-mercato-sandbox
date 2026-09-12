import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { assignmentShiftSchema } from '@/modules/taxi_fleet/data/validators'
import { buildDriverApiContext } from '@/modules/taxi_fleet/lib/driverApiContext'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['taxi_fleet.driver'] },
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const params = await Promise.resolve(ctx.params)
    const context = await buildDriverApiContext(req)
    const { translate } = await resolveTranslations()
    const body = await req.json().catch(() => ({}))
    const parsed = assignmentShiftSchema.parse({
      ...body,
      id: params.id,
    })
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
      }
    >('taxi_fleet.assignments.shift', { input: parsed, ctx: context })
    if (!result?.assignmentId) {
      return NextResponse.json(
        { error: translate('taxi_fleet.errors.shiftFailed', 'Failed to update shift.') },
        { status: 400 },
      )
    }
    return NextResponse.json({
      id: result.assignmentId,
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
    console.error('[taxi_fleet/driver/assignments/shift] POST failed', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const openApi = {
  POST: {
    summary: 'Clock in or out of today’s assignment',
    tags: ['Taxi fleet driver'],
    requestBody: { schema: assignmentShiftSchema.omit({ id: true }) },
  },
}

export default POST
