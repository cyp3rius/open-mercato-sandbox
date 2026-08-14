import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { CommandBus } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetLocationPing } from '@/modules/taxi_fleet/data/entities'
import { driverLocationBatchSchema } from '@/modules/taxi_fleet/data/validators'
import { buildDriverApiContext } from '@/modules/taxi_fleet/lib/driverApiContext'
import { resolveDriverContext } from '@/modules/taxi_fleet/lib/driverContext'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.driver'] },
  POST: { requireAuth: true, requireFeatures: ['taxi_fleet.driver'] },
}

export async function GET(req: Request) {
  try {
    const context = await buildDriverApiContext(req)
    const { translate } = await resolveTranslations()
    const driver = await resolveDriverContext(context, translate, { requireExternalApp: true })
    const em = context.container.resolve('em') as EntityManager
    const items = await findWithDecryption(
      em,
      TaxiFleetLocationPing,
      { teamMemberId: driver.teamMemberId },
      { orderBy: { recordedAt: 'DESC' }, limit: 1 },
      { tenantId: driver.teamMember.tenantId, organizationId: driver.teamMember.organizationId },
    )
    const latest = items[0] ?? null
    return NextResponse.json({
      latest: latest
        ? {
            id: latest.id,
            recordedAt: latest.recordedAt.toISOString(),
            lat: latest.lat,
            lon: latest.lon,
            accuracyM: latest.accuracyM ?? null,
            assignmentId: latest.assignmentId ?? null,
          }
        : null,
    })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const context = await buildDriverApiContext(req)
    const body = await req.json().catch(() => ({}))
    const parsed = driverLocationBatchSchema.parse(body)
    const commandBus = context.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute<typeof parsed, { accepted: number }>(
      'taxi_fleet.location.ingest',
      { input: parsed, ctx: context },
    )
    return NextResponse.json({ accepted: result?.accepted ?? 0 }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 })
    }
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('[taxi_fleet/driver/location] POST failed', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const openApi = {
  GET: { summary: 'Latest own location ping', tags: ['Taxi fleet driver'] },
  POST: {
    summary: 'Ingest location pings (active shift required)',
    tags: ['Taxi fleet driver'],
    requestBody: { schema: driverLocationBatchSchema },
  },
}
