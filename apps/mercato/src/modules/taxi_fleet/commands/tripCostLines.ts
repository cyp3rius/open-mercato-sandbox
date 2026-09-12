import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { requireId } from '@open-mercato/shared/lib/commands/helpers'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetTrip, TaxiFleetTripCostLine } from '../data/entities'
import {
  tripCostLineCreateSchema,
  tripCostLineDeleteSchema,
  type TripCostLineCreateInput,
} from '../data/validators'
import { ensureOrganizationScope, ensureTenantScope, numericToString } from './shared'

const createTripCostLineCommand: CommandHandler<TripCostLineCreateInput, { costLineId: string }> = {
  id: 'taxi_fleet.trip_cost_lines.create',
  async execute(input, ctx) {
    const parsed = tripCostLineCreateSchema.parse(input)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const trip = await findOneWithDecryption(em, TaxiFleetTrip, { id: parsed.tripId, deletedAt: null })
    if (!trip) throw new CrudHttpError(404, { error: 'Trip not found' })
    const now = new Date()
    const record = em.create(TaxiFleetTripCostLine, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      tripId: parsed.tripId,
      costType: parsed.costType,
      amount: numericToString(parsed.amount),
      currencyCode: parsed.currencyCode ?? 'PLN',
      quantity: parsed.quantity == null ? null : numericToString(parsed.quantity),
      unitPrice: parsed.unitPrice == null ? null : numericToString(parsed.unitPrice),
      receiptAttachmentId: parsed.receiptAttachmentId ?? null,
      notes: parsed.notes ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    await em.persistAndFlush(record)
    return { costLineId: record.id }
  },
}

const deleteTripCostLineCommand: CommandHandler<{ id: string }, { ok: true }> = {
  id: 'taxi_fleet.trip_cost_lines.delete',
  async execute(input, ctx) {
    const parsed = tripCostLineDeleteSchema.parse(input)
    const id = requireId(parsed.id)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, TaxiFleetTripCostLine, { id, deletedAt: null })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)
    row.deletedAt = new Date()
    await em.flush()
    return { ok: true }
  },
}

registerCommand(createTripCostLineCommand)
registerCommand(deleteTripCostLineCommand)
