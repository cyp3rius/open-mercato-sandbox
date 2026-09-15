import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { TaxiFleetDriverCommunicationRecipient } from '@/modules/taxi_fleet/data/entities'
import { driverCommunicationAckSchema } from '@/modules/taxi_fleet/data/validators'
import { buildDriverApiContext } from '@/modules/taxi_fleet/lib/driverApiContext'
import { resolveDriverContext } from '@/modules/taxi_fleet/lib/driverContext'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['taxi_fleet.driver'] },
}

export async function POST(req: Request) {
  try {
    const context = await buildDriverApiContext(req)
    const { translate } = await resolveTranslations()
    const driver = await resolveDriverContext(context, translate, { requireExternalApp: true })
    const body = await req.json().catch(() => ({}))
    const parsed = driverCommunicationAckSchema.parse(body)
    const em = context.container.resolve('em') as EntityManager

    const recipient = await em.findOne(TaxiFleetDriverCommunicationRecipient, {
      id: parsed.recipientId,
      tenantId: driver.teamMember.tenantId,
      organizationId: driver.teamMember.organizationId,
      teamMemberId: driver.teamMemberId,
      userId: context.auth!.sub,
    })
    if (!recipient) {
      throw new CrudHttpError(404, {
        error: translate('taxi_fleet.communications.errors.ackNotFound', 'Communication receipt not found.'),
      })
    }
    if (!recipient.readAt) {
      recipient.readAt = new Date()
      recipient.updatedAt = new Date()
      em.persist(recipient)
      await em.flush()
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const openApi = {
  POST: {
    summary: 'Acknowledge driver broadcast communication (read receipt)',
    tags: ['Taxi fleet driver'],
    requestBody: { schema: driverCommunicationAckSchema },
    responses: { 200: { schema: z.object({ ok: z.literal(true) }) } },
  },
}
