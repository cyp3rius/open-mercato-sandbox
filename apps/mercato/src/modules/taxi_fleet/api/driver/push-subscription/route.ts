import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { TaxiFleetPushSubscription } from '@/modules/taxi_fleet/data/entities'
import {
  driverPushSubscriptionSchema,
  driverPushUnsubscribeSchema,
} from '@/modules/taxi_fleet/data/validators'
import { buildDriverApiContext } from '@/modules/taxi_fleet/lib/driverApiContext'
import { resolveDriverContext } from '@/modules/taxi_fleet/lib/driverContext'
import {
  isWebPushConfigured,
  isWebPushEnabled,
  resolveWebPushVapidPublicKey,
} from '@/modules/taxi_fleet/lib/driverPush/vapid'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.driver'] },
  POST: { requireAuth: true, requireFeatures: ['taxi_fleet.driver'] },
  DELETE: { requireAuth: true, requireFeatures: ['taxi_fleet.driver'] },
}

export async function GET(req: Request) {
  try {
    const context = await buildDriverApiContext(req)
    const { translate } = await resolveTranslations()
    const driver = await resolveDriverContext(context, translate, { requireExternalApp: true })
    const em = context.container.resolve('em') as EntityManager
    const configured = isWebPushConfigured()
    const vapidPublicKey = resolveWebPushVapidPublicKey()
    const active = await em.findOne(TaxiFleetPushSubscription, {
      tenantId: driver.teamMember.tenantId,
      organizationId: driver.teamMember.organizationId,
      teamMemberId: driver.teamMemberId,
      userId: context.auth!.sub,
      deletedAt: null,
    })
    return NextResponse.json({
      enabled: isWebPushEnabled(),
      configured,
      subscribed: Boolean(active),
      vapidPublicKey: configured ? vapidPublicKey : null,
    })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    if (!isWebPushEnabled()) {
      return NextResponse.json({ error: 'Web Push is disabled' }, { status: 403 })
    }
    if (!isWebPushConfigured()) {
      return NextResponse.json(
        { error: 'Web Push is enabled but VAPID keys are not configured' },
        { status: 503 },
      )
    }
    const context = await buildDriverApiContext(req)
    const { translate } = await resolveTranslations()
    const driver = await resolveDriverContext(context, translate, { requireExternalApp: true })
    const userId = context.auth?.sub
    if (!userId) throw new CrudHttpError(401, { error: 'Unauthorized' })

    const body = await req.json().catch(() => ({}))
    const parsed = driverPushSubscriptionSchema.parse(body)
    const em = context.container.resolve('em') as EntityManager
    const userAgent = req.headers.get('user-agent')?.slice(0, 500) ?? null

    let row = await em.findOne(TaxiFleetPushSubscription, { endpoint: parsed.endpoint })
    if (row) {
      row.tenantId = driver.teamMember.tenantId
      row.organizationId = driver.teamMember.organizationId
      row.userId = userId
      row.teamMemberId = driver.teamMemberId
      row.p256dh = parsed.keys.p256dh
      row.auth = parsed.keys.auth
      row.userAgent = userAgent
      row.deletedAt = null
      row.updatedAt = new Date()
      em.persist(row)
    } else {
      row = em.create(TaxiFleetPushSubscription, {
        tenantId: driver.teamMember.tenantId,
        organizationId: driver.teamMember.organizationId,
        userId,
        teamMemberId: driver.teamMemberId,
        endpoint: parsed.endpoint,
        p256dh: parsed.keys.p256dh,
        auth: parsed.keys.auth,
        userAgent,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      })
      em.persist(row)
    }
    await em.flush()
    return NextResponse.json({ ok: true, id: row.id }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 })
    }
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('[taxi_fleet/driver/push-subscription] POST failed', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const context = await buildDriverApiContext(req)
    const { translate } = await resolveTranslations()
    const driver = await resolveDriverContext(context, translate, { requireExternalApp: true })
    const userId = context.auth?.sub
    if (!userId) throw new CrudHttpError(401, { error: 'Unauthorized' })

    const body = await req.json().catch(() => ({}))
    const parsed = driverPushUnsubscribeSchema.parse(body)
    const em = context.container.resolve('em') as EntityManager
    const row = await em.findOne(TaxiFleetPushSubscription, {
      endpoint: parsed.endpoint,
      teamMemberId: driver.teamMemberId,
      userId,
      deletedAt: null,
    })
    if (row) {
      row.deletedAt = new Date()
      row.updatedAt = new Date()
      await em.flush()
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 })
    }
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const openApi = {
  GET: { summary: 'Driver Web Push subscription status', tags: ['Taxi fleet driver'] },
  POST: {
    summary: 'Register or refresh Web Push subscription',
    tags: ['Taxi fleet driver'],
    requestBody: { schema: driverPushSubscriptionSchema },
  },
  DELETE: {
    summary: 'Unregister Web Push subscription',
    tags: ['Taxi fleet driver'],
    requestBody: { schema: driverPushUnsubscribeSchema },
  },
}
