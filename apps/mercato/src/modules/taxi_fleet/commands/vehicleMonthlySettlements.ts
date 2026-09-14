import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetVehicleMonthlySettlement } from '../data/entities'
import {
  vehicleMonthlySettlementDeleteSchema,
  vehicleMonthlySettlementGenerateSchema,
  vehicleMonthlySettlementSyncBpSchema,
  vehicleMonthlySettlementUpdateSchema,
  type VehicleMonthlySettlementDeleteInput,
  type VehicleMonthlySettlementGenerateInput,
  type VehicleMonthlySettlementSyncBpInput,
  type VehicleMonthlySettlementUpdateInput,
} from '../data/validators'
import {
  calculateVehicleMonthlySettlement,
  listVehicleResourceIdsForMonth,
  type VehicleMonthlySettlementTotals,
} from '../lib/vehicleMonthlySettlementCalculator'
import { syncBpFuelCostForVehicleMonth } from '../lib/bpOpenFleet/syncVehicleMonth'
import { formatDistanceKm } from '../lib/settlementTripDistance'
import {
  canDeleteVehicleMonthlySettlement,
  isAllowedVehicleMonthlySettlementStatusTransition,
  isVehicleMonthlySettlementLocked,
} from '../lib/settlementStatusTransitions'
import { isMonthFullyCompleted } from '../lib/weekUtils'
import { ensureOrganizationScope, ensureTenantScope, numericToString } from './shared'

function applyVehicleMonthlyTotals(
  row: TaxiFleetVehicleMonthlySettlement,
  totals: VehicleMonthlySettlementTotals,
) {
  row.shiftGpsKm = formatDistanceKm(totals.shiftGpsKm)
  row.tripKm = formatDistanceKm(totals.tripKm)
  row.emptyKm = formatDistanceKm(totals.emptyKm)
  row.revenueGross = numericToString(totals.revenueGross)
  row.revenueNet = numericToString(totals.revenueNet)
  row.bpFuelCost = numericToString(totals.bpFuelCost)
  row.cashExpected = numericToString(totals.cashExpected)
  row.snapshotJson = {
    ...totals.snapshot,
    cashReported: Number(row.cashReported ?? 0),
  } as unknown as Record<string, unknown>
}

async function generateOneVehicleMonthly(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    resourceId: string
    monthStart: string
  },
): Promise<TaxiFleetVehicleMonthlySettlement> {
  const existing = await findOneWithDecryption(
    em,
    TaxiFleetVehicleMonthlySettlement,
    {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      resourceId: params.resourceId,
      monthStart: params.monthStart,
      deletedAt: null,
    },
    undefined,
    { tenantId: params.tenantId, organizationId: params.organizationId },
  )
  if (existing) {
    const { translate } = await resolveTranslations()
    throw new CrudHttpError(409, {
      error: translate(
        'taxi_fleet.vehicleMonthlySettlements.errors.exists',
        'Vehicle monthly settlement already exists for this vehicle and month.',
      ),
    })
  }

  const totals = await calculateVehicleMonthlySettlement(em, params)
  const now = new Date()
  const record = em.create(TaxiFleetVehicleMonthlySettlement, {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    resourceId: params.resourceId,
    monthStart: params.monthStart,
    status: 'draft',
    cashReported: '0',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  } as never)
  applyVehicleMonthlyTotals(record, totals)
  await em.persistAndFlush(record)
  return record
}

const generateVehicleMonthlyCommand: CommandHandler<
  VehicleMonthlySettlementGenerateInput,
  { settlementIds: string[]; settlementId?: string }
> = {
  id: 'taxi_fleet.vehicle_monthly_settlements.generate_month',
  async execute(input, ctx) {
    const parsed = vehicleMonthlySettlementGenerateSchema.parse(input)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const { translate } = await resolveTranslations()
    if (!isMonthFullyCompleted(parsed.monthStart)) {
      throw new CrudHttpError(400, {
        error: translate(
          'taxi_fleet.vehicleMonthlySettlements.errors.monthNotEnded',
          'Monthly vehicle settlement can only be generated after the calendar month has ended.',
        ),
      })
    }

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const resourceIds = parsed.resourceId
      ? [parsed.resourceId]
      : await listVehicleResourceIdsForMonth(em, {
          tenantId: parsed.tenantId,
          organizationId: parsed.organizationId,
          monthStart: parsed.monthStart,
        })

    if (!resourceIds.length) {
      throw new CrudHttpError(400, {
        error: translate(
          'taxi_fleet.vehicleMonthlySettlements.errors.noVehicles',
          'No vehicles with assignments or trips found for this month.',
        ),
      })
    }

    const settlementIds: string[] = []
    for (const resourceId of resourceIds) {
      const existing = await findOneWithDecryption(
        em,
        TaxiFleetVehicleMonthlySettlement,
        {
          tenantId: parsed.tenantId,
          organizationId: parsed.organizationId,
          resourceId,
          monthStart: parsed.monthStart,
          deletedAt: null,
        },
        undefined,
        { tenantId: parsed.tenantId, organizationId: parsed.organizationId },
      )
      if (existing) continue
      try {
        const row = await generateOneVehicleMonthly(em, {
          tenantId: parsed.tenantId,
          organizationId: parsed.organizationId,
          resourceId,
          monthStart: parsed.monthStart,
        })
        settlementIds.push(row.id)
      } catch (err) {
        if (err instanceof CrudHttpError && err.status === 409) continue
        throw err
      }
    }

    if (!settlementIds.length) {
      throw new CrudHttpError(409, {
        error: translate(
          'taxi_fleet.vehicleMonthlySettlements.errors.exists',
          'Vehicle monthly settlement already exists for this vehicle and month.',
        ),
      })
    }

    return {
      settlementIds,
      settlementId: settlementIds[0],
    }
  },
}

const updateVehicleMonthlyCommand: CommandHandler<VehicleMonthlySettlementUpdateInput, { settlementId: string }> = {
  id: 'taxi_fleet.vehicle_monthly_settlements.update',
  async execute(input, ctx) {
    const parsed = vehicleMonthlySettlementUpdateSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, TaxiFleetVehicleMonthlySettlement, {
      id: parsed.id,
      deletedAt: null,
    })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)

    const { translate } = await resolveTranslations()
    const locked = isVehicleMonthlySettlementLocked(row.status)
    if (locked && parsed.status === undefined && parsed.recalculateSettlement !== true) {
      if (parsed.cashReported !== undefined || parsed.notes !== undefined) {
        throw new CrudHttpError(409, {
          error: translate(
            'taxi_fleet.vehicleMonthlySettlements.errors.locked',
            'Approved vehicle settlements cannot be edited.',
          ),
        })
      }
    }

    if (parsed.status !== undefined && parsed.status !== row.status) {
      if (!isAllowedVehicleMonthlySettlementStatusTransition(row.status, parsed.status)) {
        throw new CrudHttpError(400, {
          error: translate(
            'taxi_fleet.vehicleMonthlySettlements.errors.invalidStatus',
            'Invalid status transition.',
          ),
        })
      }
      row.status = parsed.status
      if (parsed.status === 'submitted' && !row.submittedAt) row.submittedAt = new Date()
      if (parsed.status === 'approved') {
        row.approvedAt = new Date()
        row.approvedByUserId = ctx.auth?.sub ?? null
      }
    }

    if (parsed.notes !== undefined) row.notes = parsed.notes
    if (parsed.cashReported !== undefined) {
      row.cashReported = numericToString(parsed.cashReported)
    }

    if (parsed.recalculateSettlement === true) {
      if (isVehicleMonthlySettlementLocked(row.status)) {
        throw new CrudHttpError(409, {
          error: translate(
            'taxi_fleet.vehicleMonthlySettlements.errors.locked',
            'Approved vehicle settlements cannot be edited.',
          ),
        })
      }
      const totals = await calculateVehicleMonthlySettlement(em, {
        tenantId: row.tenantId,
        organizationId: row.organizationId,
        resourceId: row.resourceId,
        monthStart: row.monthStart,
      })
      applyVehicleMonthlyTotals(row, totals)
    } else if (parsed.cashReported !== undefined && row.snapshotJson) {
      row.snapshotJson = {
        ...row.snapshotJson,
        cashReported: Number(row.cashReported ?? 0),
      }
    }

    row.updatedAt = new Date()
    await em.persistAndFlush(row)
    return { settlementId: row.id }
  },
}

const deleteVehicleMonthlyCommand: CommandHandler<VehicleMonthlySettlementDeleteInput, { settlementId: string }> = {
  id: 'taxi_fleet.vehicle_monthly_settlements.delete',
  async execute(input, ctx) {
    const parsed = vehicleMonthlySettlementDeleteSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, TaxiFleetVehicleMonthlySettlement, {
      id: parsed.id,
      deletedAt: null,
    })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)
    const { translate } = await resolveTranslations()
    if (!canDeleteVehicleMonthlySettlement(row.status)) {
      throw new CrudHttpError(409, {
        error: translate(
          'taxi_fleet.vehicleMonthlySettlements.errors.deleteNotDraft',
          'Only draft vehicle settlements can be deleted.',
        ),
      })
    }
    row.deletedAt = new Date()
    row.updatedAt = new Date()
    await em.persistAndFlush(row)
    return { settlementId: row.id }
  },
}

const syncBpVehicleMonthlyCommand: CommandHandler<
  VehicleMonthlySettlementSyncBpInput,
  { settlementId: string; bpFuelCost: number; transactionCount: number }
> = {
  id: 'taxi_fleet.vehicle_monthly_settlements.sync_bp',
  async execute(input, ctx) {
    const parsed = vehicleMonthlySettlementSyncBpSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, TaxiFleetVehicleMonthlySettlement, {
      id: parsed.id,
      deletedAt: null,
    })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)
    const { translate } = await resolveTranslations()
    if (isVehicleMonthlySettlementLocked(row.status)) {
      throw new CrudHttpError(409, {
        error: translate(
          'taxi_fleet.vehicleMonthlySettlements.errors.locked',
          'Approved vehicle settlements cannot be edited.',
        ),
      })
    }

    let synced: Awaited<ReturnType<typeof syncBpFuelCostForVehicleMonth>>
    try {
      synced = await syncBpFuelCostForVehicleMonth(em, {
        tenantId: row.tenantId,
        organizationId: row.organizationId,
        resourceId: row.resourceId,
        monthStart: row.monthStart,
      })
    } catch (err) {
      if (err instanceof Error && err.message === 'MISSING_BP_FUEL_CARD') {
        throw new CrudHttpError(400, {
          error: translate(
            'taxi_fleet.vehicleMonthlySettlements.errors.bpCardMissing',
            'Assign a BP fuel card number on the taxi resource before syncing.',
          ),
        })
      }
      throw new CrudHttpError(502, {
        error:
          err instanceof Error && err.message
            ? err.message
            : translate(
                'taxi_fleet.vehicleMonthlySettlements.errors.bpSyncFailed',
                'BP Open Fleet sync failed.',
              ),
      })
    }

    row.bpFuelCost = numericToString(synced.bpFuelCost)
    row.snapshotJson = {
      ...(row.snapshotJson ?? {}),
      bpFuelCost: synced.bpFuelCost,
      bpCardNumber: synced.cardNumber,
      bpSyncedAt: synced.syncedAt,
      bpTransactionCount: synced.transactionCount,
      bpTransactions: synced.transactions,
    } as unknown as Record<string, unknown>
    row.updatedAt = new Date()
    await em.persistAndFlush(row)
    return {
      settlementId: row.id,
      bpFuelCost: synced.bpFuelCost,
      transactionCount: synced.transactionCount,
    }
  },
}

registerCommand(generateVehicleMonthlyCommand)
registerCommand(updateVehicleMonthlyCommand)
registerCommand(deleteVehicleMonthlyCommand)
registerCommand(syncBpVehicleMonthlyCommand)
