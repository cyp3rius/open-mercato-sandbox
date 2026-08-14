import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import { findOneWithDecryption, findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetTrip } from '@/modules/taxi_fleet/data/entities'
import { tripCreateSchema, tripUpdateSchema } from '@/modules/taxi_fleet/data/validators'
import { resolveDriverContext } from '@/modules/taxi_fleet/lib/driverContext'
import { resolveDriverTripUpdateInput } from '@/modules/taxi_fleet/lib/driverTripExecution'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.driver'] },
  POST: { requireAuth: true, requireFeatures: ['taxi_fleet.driver'] },
  PUT: { requireAuth: true, requireFeatures: ['taxi_fleet.driver'] },
}

async function buildContext(req: Request): Promise<CommandRuntimeContext> {
  const container = await createRequestContainer()
  const auth = await getAuthFromRequest(req)
  if (!auth) throw new CrudHttpError(401, { error: 'Unauthorized' })
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  return {
    container,
    auth,
    organizationScope: scope,
    selectedOrganizationId: scope?.selectedId ?? auth.orgId ?? null,
    organizationIds: scope?.filterIds ?? (auth.orgId ? [auth.orgId] : null),
    request: req,
  }
}

export async function GET(req: Request) {
  try {
    const context = await buildContext(req)
    const { translate } = await resolveTranslations()
    const driver = await resolveDriverContext(context, translate, { requireExternalApp: true })
    const em = context.container.resolve('em') as EntityManager
    const items = await findWithDecryption(
      em,
      TaxiFleetTrip,
      { teamMemberId: driver.teamMemberId, deletedAt: null },
      { orderBy: { startedAt: 'DESC' } },
      { tenantId: driver.teamMember.tenantId, organizationId: driver.teamMember.organizationId },
    )
    return NextResponse.json({ items })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

const driverTripReceiptSchema = z.object({
  receiptDocumentNumber: z.string().trim().max(120).optional().nullable(),
  receiptAttachmentId: z.string().uuid().optional().nullable(),
})

export async function POST(req: Request) {
  try {
    const context = await buildContext(req)
    const { translate } = await resolveTranslations()
    const driver = await resolveDriverContext(context, translate, { requireExternalApp: true })
    const body = await req.json().catch(() => ({}))
    const receipt = driverTripReceiptSchema.parse(body)
    const receiptDocumentNumber = receipt.receiptDocumentNumber?.trim() || null
    const receiptAttachmentId = receipt.receiptAttachmentId || null
    const existingMetadata =
      body && typeof body === 'object' && body.metadata && typeof body.metadata === 'object'
        ? (body.metadata as Record<string, unknown>)
        : {}
    const metadata =
      receiptDocumentNumber || receiptAttachmentId
        ? {
            ...existingMetadata,
            ...(receiptDocumentNumber ? { receiptDocumentNumber } : {}),
            ...(receiptAttachmentId ? { receiptAttachmentId } : {}),
          }
        : body.metadata ?? null

    const scoped = parseScopedCommandInput(
      tripCreateSchema,
      {
        ...body,
        metadata,
        teamMemberId: driver.teamMemberId,
        tenantId: driver.teamMember.tenantId,
        organizationId: driver.teamMember.organizationId,
      },
      context,
      translate,
    )
    const commandBus = context.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute<typeof scoped, { tripId: string }>('taxi_fleet.trips.create', {
      input: scoped,
      ctx: context,
    })
    const tripId = result?.tripId ?? null

    const revenueAmount =
      typeof scoped.revenueAmount === 'number' ? scoped.revenueAmount : Number(scoped.revenueAmount ?? 0)
    const hasCustomerLink = Boolean(
      scoped.customerEntityId || scoped.customerPersonId || scoped.customerCompanyId,
    )
    if (
      tripId &&
      revenueAmount > 0 &&
      hasCustomerLink &&
      (receiptDocumentNumber || receiptAttachmentId)
    ) {
      await commandBus.execute('taxi_fleet.financial_entries.create', {
        input: {
          tenantId: driver.teamMember.tenantId,
          organizationId: driver.teamMember.organizationId,
          teamMemberId: driver.teamMemberId,
          kind: 'income',
          incomeDocumentType: 'receipt',
          tripId,
          customerEntityId: scoped.customerEntityId ?? undefined,
          customerPersonId: scoped.customerPersonId ?? undefined,
          customerCompanyId: scoped.customerCompanyId ?? undefined,
          amount: revenueAmount,
          currencyCode: scoped.currencyCode ?? 'PLN',
          documentNumber: receiptDocumentNumber,
          occurredAt: scoped.startedAt ?? new Date(),
          receiptAttachmentId,
        },
        ctx: context,
      })
    }

    return NextResponse.json({ id: tripId }, { status: 201 })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.flatten() }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const context = await buildContext(req)
    const { translate } = await resolveTranslations()
    const driver = await resolveDriverContext(context, translate, { requireExternalApp: true })
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const em = context.container.resolve('em') as EntityManager
    const tripId = typeof body.id === 'string' ? body.id : null
    if (!tripId) throw new CrudHttpError(400, { error: 'Missing trip id' })
    const existing = await findOneWithDecryption(
      em,
      TaxiFleetTrip,
      { id: tripId, teamMemberId: driver.teamMemberId, deletedAt: null },
      undefined,
      { tenantId: driver.teamMember.tenantId, organizationId: driver.teamMember.organizationId },
    )
    if (!existing) throw new CrudHttpError(404, { error: 'Not found' })
    const { input } = resolveDriverTripUpdateInput(existing.status, body)
    const parsed = tripUpdateSchema.parse(input)
    const commandBus = context.container.resolve('commandBus') as CommandBus
    await commandBus.execute('taxi_fleet.trips.update', { input: parsed, ctx: context })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.flatten() }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const openApi = {
  GET: { summary: 'List driver trips', tags: ['Taxi fleet driver'] },
  POST: { summary: 'Create driver trip', tags: ['Taxi fleet driver'], requestBody: { schema: tripCreateSchema } },
  PUT: { summary: 'Update driver trip', tags: ['Taxi fleet driver'], requestBody: { schema: tripUpdateSchema } },
}
