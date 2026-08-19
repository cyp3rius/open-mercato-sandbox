import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetMonthlySettlement } from '../data/entities'
import {
  monthlySettlementGenerateSchema,
  monthlySettlementUpdateSchema,
  type MonthlySettlementGenerateInput,
  type MonthlySettlementUpdateInput,
} from '../data/validators'
import { calculateMonthlySettlement } from '../lib/monthlySettlementCalculator'
import { formatDistanceKm } from '../lib/settlementTripDistance'
import { ensureOrganizationScope, ensureTenantScope, numericToString } from './shared'

function applyMonthlyTotals(row: TaxiFleetMonthlySettlement, totals: Awaited<ReturnType<typeof calculateMonthlySettlement>>) {
  row.revenueGross = numericToString(totals.revenueGross)
  row.revenueNet = numericToString(totals.revenueNet)
  row.costsGross = numericToString(totals.costsGross)
  row.costsNet = numericToString(totals.costsNet)
  row.netAmount = numericToString(totals.netAmount)
  row.payoutAmount = numericToString(totals.payoutAmount)
  row.totalDistanceKm = formatDistanceKm(totals.totalDistanceKm)
  row.cashExpected = numericToString(totals.cashExpected)
  row.cashCollected = numericToString(totals.cashCollected)
  row.bonusAmount = numericToString(totals.bonusAmount)
  row.compensationAmount = numericToString(totals.compensationAmount)
  row.airportA4Amount = numericToString(totals.airportA4Amount)
  row.transferAmount = numericToString(totals.transferAmount)
  row.weeklyCount = totals.weeklyCount
  row.driverCount = totals.driverCount
  row.snapshotJson = totals.snapshot as unknown as Record<string, unknown>
}

const generateMonthlySettlementCommand: CommandHandler<MonthlySettlementGenerateInput, { settlementId: string }> = {
  id: 'taxi_fleet.monthly_settlements.generate_month',
  async execute(input, ctx) {
    const parsed = monthlySettlementGenerateSchema.parse(input)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const existing = await findOneWithDecryption(
      em,
      TaxiFleetMonthlySettlement,
      {
        tenantId: parsed.tenantId,
        organizationId: parsed.organizationId,
        monthStart: parsed.monthStart,
        deletedAt: null,
      },
      undefined,
      { tenantId: parsed.tenantId, organizationId: parsed.organizationId },
    )
    if (existing) {
      const { translate } = await resolveTranslations()
      throw new CrudHttpError(409, {
        error: translate('taxi_fleet.monthlySettlements.errors.exists', 'Monthly settlement already exists for this month.'),
      })
    }
    const totals = await calculateMonthlySettlement(em, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      monthStart: parsed.monthStart,
    })
    const now = new Date()
    const record = em.create(TaxiFleetMonthlySettlement, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      monthStart: parsed.monthStart,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    applyMonthlyTotals(record, totals)
    await em.persistAndFlush(record)
    return { settlementId: record.id }
  },
}

const updateMonthlySettlementCommand: CommandHandler<MonthlySettlementUpdateInput, { settlementId: string }> = {
  id: 'taxi_fleet.monthly_settlements.update',
  async execute(input, ctx) {
    const parsed = monthlySettlementUpdateSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, TaxiFleetMonthlySettlement, { id: parsed.id, deletedAt: null })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)
    if (parsed.status !== undefined) {
      row.status = parsed.status
      if (parsed.status === 'approved') {
        row.approvedAt = new Date()
        row.approvedByUserId = ctx.auth?.sub ?? null
      }
    }
    if (parsed.notes !== undefined) row.notes = parsed.notes
    if (parsed.recalculateSettlement) {
      const totals = await calculateMonthlySettlement(em, {
        tenantId: row.tenantId,
        organizationId: row.organizationId,
        monthStart: row.monthStart,
      })
      applyMonthlyTotals(row, totals)
    }
    await em.flush()
    return { settlementId: row.id }
  },
}

registerCommand(generateMonthlySettlementCommand)
registerCommand(updateMonthlySettlementCommand)
