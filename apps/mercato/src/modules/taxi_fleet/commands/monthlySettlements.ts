import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findWithDecryption, findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import {
  TaxiFleetDriverProfile,
  TaxiFleetMonthlySettlement,
  TaxiFleetMonthlySettlementDocument,
  TaxiFleetWeeklySettlement,
} from '../data/entities'
import {
  monthlySettlementDeleteSchema,
  monthlySettlementDocumentCreateSchema,
  monthlySettlementDocumentDeleteSchema,
  monthlySettlementGenerateSchema,
  monthlySettlementUpdateSchema,
  type MonthlySettlementDeleteInput,
  type MonthlySettlementDocumentCreateInput,
  type MonthlySettlementDocumentDeleteInput,
  type MonthlySettlementGenerateInput,
  type MonthlySettlementUpdateInput,
} from '../data/validators'
import { calculateMonthlySettlementForDriver } from '../lib/monthlySettlementCalculator'
import { formatDistanceKm } from '../lib/settlementTripDistance'
import { isMonthlySettlementLocked } from '../lib/settlementLock'
import {
  canDeleteMonthlySettlement,
  isAllowedMonthlySettlementStatusTransition,
} from '../lib/settlementStatusTransitions'
import { loadDriverPayoutScheduleForMember } from '../lib/monthlySettlementPayout'
import { getMonthEnd, isMonthFullyCompleted } from '../lib/weekUtils'
import { ensureOrganizationScope, ensureTenantScope, numericToString } from './shared'

function applyMonthlyTotals(
  row: TaxiFleetMonthlySettlement,
  totals: Awaited<ReturnType<typeof calculateMonthlySettlementForDriver>>,
) {
  row.revenueGross = numericToString(totals.revenueGross)
  row.revenueNet = numericToString(totals.revenueNet)
  row.costsGross = numericToString(totals.costsGross)
  row.costsNet = numericToString(totals.costsNet)
  row.netAmount = numericToString(totals.netAmount)
  row.payoutPercent = numericToString(totals.payoutPercent)
  row.payoutAmount = numericToString(totals.payoutAmount)
  row.computedDistanceKm = formatDistanceKm(totals.computedDistanceKm)
  row.totalDistanceKm = formatDistanceKm(totals.totalDistanceKm)
  row.emptyDistanceKm = formatDistanceKm(totals.emptyDistanceKm)
  row.cashExpected = numericToString(totals.cashExpected)
  row.cashCollected = numericToString(totals.cashCollected)
  row.transferAmount = numericToString(totals.transferAmount)
  row.weeklyCount = totals.weeklyCount
  row.driverCount = 1
  row.snapshotJson = {
    ...totals.snapshot,
    payout: {
      mode: 'segmented',
      segmentsCount: totals.snapshot.segments.length,
      transferOnly: true,
    },
  } as unknown as Record<string, unknown>
}

function isMonthlyClosureUpdate(parsed: MonthlySettlementUpdateInput): boolean {
  return parsed.closureType !== undefined || parsed.closureAmount !== undefined
}

async function generateOneMonthly(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    teamMemberId: string
    monthStart: string
  },
): Promise<TaxiFleetMonthlySettlement> {
  const existing = await findOneWithDecryption(
    em,
    TaxiFleetMonthlySettlement,
    {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      teamMemberId: params.teamMemberId,
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
        'taxi_fleet.monthlySettlements.errors.exists',
        'Monthly settlement already exists for this driver and month.',
      ),
    })
  }

  const payoutSchedule = await loadDriverPayoutScheduleForMember(em, params)
  const totals = await calculateMonthlySettlementForDriver(em, {
    ...params,
    payoutSchedule: payoutSchedule ?? undefined,
    payoutPercent: payoutSchedule?.fixedPercent,
  })

  const now = new Date()
  const record = em.create(TaxiFleetMonthlySettlement, {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    teamMemberId: params.teamMemberId,
    monthStart: params.monthStart,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  } as any)
  applyMonthlyTotals(record, totals)
  await em.persistAndFlush(record)
  return record
}

const generateMonthlySettlementCommand: CommandHandler<
  MonthlySettlementGenerateInput,
  { settlementIds: string[]; settlementId?: string }
> = {
  id: 'taxi_fleet.monthly_settlements.generate_month',
  async execute(input, ctx) {
    const parsed = monthlySettlementGenerateSchema.parse(input)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const { translate } = await resolveTranslations()

    if (!isMonthFullyCompleted(parsed.monthStart)) {
      throw new CrudHttpError(409, {
        error: translate(
          'taxi_fleet.monthlySettlements.errors.monthNotCompleted',
          'Monthly settlement can only be generated after the calendar month has ended.',
        ),
      })
    }

    const em = (ctx.container.resolve('em') as EntityManager).fork()

    let teamMemberIds: string[] = []
    if (parsed.teamMemberId) {
      teamMemberIds = [parsed.teamMemberId]
    } else {
      const [profiles, weeklies] = await Promise.all([
        findWithDecryption(
          em,
          TaxiFleetDriverProfile,
          {
            tenantId: parsed.tenantId,
            organizationId: parsed.organizationId,
            deletedAt: null,
          },
          undefined,
          { tenantId: parsed.tenantId, organizationId: parsed.organizationId },
        ),
        findWithDecryption(
          em,
          TaxiFleetWeeklySettlement,
          {
            tenantId: parsed.tenantId,
            organizationId: parsed.organizationId,
            deletedAt: null,
            weekStart: {
              $gte: parsed.monthStart,
              $lte: getMonthEnd(parsed.monthStart),
            },
          },
          undefined,
          { tenantId: parsed.tenantId, organizationId: parsed.organizationId },
        ),
      ])
      const idSet = new Set<string>()
      for (const profile of profiles) idSet.add(profile.teamMemberId)
      for (const weekly of weeklies) idSet.add(weekly.teamMemberId)
      teamMemberIds = [...idSet]
    }

    if (teamMemberIds.length === 0) {
      throw new CrudHttpError(404, {
        error: translate(
          'taxi_fleet.monthlySettlements.errors.noDrivers',
          'No drivers found to generate monthly settlements for.',
        ),
      })
    }

    const settlementIds: string[] = []
    for (const teamMemberId of teamMemberIds) {
      const existing = await findOneWithDecryption(
        em,
        TaxiFleetMonthlySettlement,
        {
          tenantId: parsed.tenantId,
          organizationId: parsed.organizationId,
          teamMemberId,
          monthStart: parsed.monthStart,
          deletedAt: null,
        },
        undefined,
        { tenantId: parsed.tenantId, organizationId: parsed.organizationId },
      )
      if (existing) continue
      try {
        const record = await generateOneMonthly(em, {
          tenantId: parsed.tenantId,
          organizationId: parsed.organizationId,
          teamMemberId,
          monthStart: parsed.monthStart,
        })
        settlementIds.push(record.id)
      } catch (err) {
        if (err instanceof Error && err.message === 'MONTH_NOT_COMPLETED') {
          throw new CrudHttpError(409, {
            error: translate(
              'taxi_fleet.monthlySettlements.errors.monthNotCompleted',
              'Monthly settlement can only be generated after the calendar month has ended.',
            ),
          })
        }
        throw err
      }
    }

    if (settlementIds.length === 0) {
      throw new CrudHttpError(409, {
        error: translate(
          'taxi_fleet.monthlySettlements.errors.exists',
          'Monthly settlement already exists for this driver and month.',
        ),
      })
    }

    return { settlementIds, settlementId: settlementIds[0] }
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
    const { translate } = await resolveTranslations()

    const closureUpdate = isMonthlyClosureUpdate(parsed)

    if (parsed.status !== undefined && parsed.status !== row.status) {
      if (!isAllowedMonthlySettlementStatusTransition(row.status, parsed.status)) {
        throw new CrudHttpError(409, {
          error: translate(
            'taxi_fleet.errors.settlementStatusTransition',
            'This status change is not allowed.',
          ),
        })
      }
    }

    if (closureUpdate) {
      if (row.status !== 'approved') {
        throw new CrudHttpError(409, {
          error: translate(
            'taxi_fleet.errors.settlementCloseNotApproved',
            'Only approved settlements can be closed and paid out.',
          ),
        })
      }
      row.closureType = parsed.closureType ?? null
      row.closureAmount = numericToString(parsed.closureAmount)
      row.closedAt = new Date()
      row.status = 'paid'
    } else if (parsed.status === 'paid') {
      throw new CrudHttpError(409, {
        error: translate(
          'taxi_fleet.errors.settlementCloseNotApproved',
          'Only approved settlements can be closed and paid out.',
        ),
      })
    } else if (
      !parsed.recalculateSettlement &&
      parsed.status === undefined &&
      isMonthlySettlementLocked(row.status)
    ) {
      throw new CrudHttpError(409, {
        error: translate(
          'taxi_fleet.errors.settlementLocked',
          'Approved settlements cannot be modified. Change the status first if you need to edit amounts or costs.',
        ),
      })
    } else {
      if (parsed.notes !== undefined) row.notes = parsed.notes
      if (parsed.bonusAmount !== undefined) row.bonusAmount = numericToString(parsed.bonusAmount)
      if (parsed.compensationAmount !== undefined) {
        row.compensationAmount = numericToString(parsed.compensationAmount)
      }
      if (parsed.airportA4Amount !== undefined) row.airportA4Amount = numericToString(parsed.airportA4Amount)
      if (parsed.totalDistanceKm !== undefined) {
        row.totalDistanceKm = formatDistanceKm(parsed.totalDistanceKm)
      }

      if (
        parsed.recalculateSettlement ||
        parsed.bonusAmount !== undefined ||
        parsed.compensationAmount !== undefined ||
        parsed.airportA4Amount !== undefined
      ) {
        if (isMonthlySettlementLocked(row.status) && parsed.status === undefined) {
          throw new CrudHttpError(409, {
            error: translate(
              'taxi_fleet.errors.settlementLocked',
              'Approved settlements cannot be modified. Change the status first if you need to edit amounts or costs.',
            ),
          })
        }
        const payoutSchedule = await loadDriverPayoutScheduleForMember(em, {
          tenantId: row.tenantId,
          organizationId: row.organizationId,
          teamMemberId: row.teamMemberId,
        })
        const totals = await calculateMonthlySettlementForDriver(em, {
          tenantId: row.tenantId,
          organizationId: row.organizationId,
          teamMemberId: row.teamMemberId,
          monthStart: row.monthStart,
          payoutSchedule: payoutSchedule ?? undefined,
          payoutPercent: Number(row.payoutPercent) || payoutSchedule?.fixedPercent,
          bonusAmount: Number(row.bonusAmount),
          compensationAmount: Number(row.compensationAmount),
          airportA4Amount: Number(row.airportA4Amount),
          totalDistanceKm: parsed.totalDistanceKm ?? Number(row.totalDistanceKm),
          excludeMonthlySettlementId: row.id,
        })
        applyMonthlyTotals(row, totals)
      }

      if (parsed.status !== undefined) {
        row.status = parsed.status
        if (parsed.status === 'approved') {
          row.approvedAt = new Date()
          row.approvedByUserId = ctx.auth?.sub ?? null
        }
        if (parsed.status === 'submitted') row.submittedAt = new Date()
      }
    }

    await em.flush()
    return { settlementId: row.id }
  },
}

const deleteMonthlySettlementCommand: CommandHandler<MonthlySettlementDeleteInput, { settlementId: string }> = {
  id: 'taxi_fleet.monthly_settlements.delete',
  async execute(input, ctx) {
    const parsed = monthlySettlementDeleteSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, TaxiFleetMonthlySettlement, { id: parsed.id, deletedAt: null })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)
    if (!canDeleteMonthlySettlement(row.status)) {
      const { translate } = await resolveTranslations()
      throw new CrudHttpError(409, {
        error: translate('taxi_fleet.errors.settlementDeleteNotDraft', 'Only draft settlements can be deleted.'),
      })
    }
    row.deletedAt = new Date()
    await em.flush()
    return { settlementId: row.id }
  },
}

const createMonthlyDocumentCommand: CommandHandler<
  MonthlySettlementDocumentCreateInput,
  { documentId: string }
> = {
  id: 'taxi_fleet.monthly_settlement_documents.create',
  async execute(input, ctx) {
    const parsed = monthlySettlementDocumentCreateSchema.parse(input)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const now = new Date()
    const record = em.create(TaxiFleetMonthlySettlementDocument, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      monthStart: parsed.monthStart,
      kind: parsed.kind,
      resourceId: parsed.resourceId ?? null,
      attachmentId: parsed.attachmentId ?? null,
      fileName: parsed.fileName ?? null,
      parsedJson: parsed.parsedJson ?? null,
      notes: parsed.notes ?? null,
      uploadedByUserId: ctx.auth?.sub ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    } as any)
    await em.persistAndFlush(record)
    return { documentId: record.id }
  },
}

const deleteMonthlyDocumentCommand: CommandHandler<
  MonthlySettlementDocumentDeleteInput,
  { documentId: string }
> = {
  id: 'taxi_fleet.monthly_settlement_documents.delete',
  async execute(input, ctx) {
    const parsed = monthlySettlementDocumentDeleteSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, TaxiFleetMonthlySettlementDocument, {
      id: parsed.id,
      deletedAt: null,
    })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)
    row.deletedAt = new Date()
    await em.flush()
    return { documentId: row.id }
  },
}

registerCommand(generateMonthlySettlementCommand)
registerCommand(updateMonthlySettlementCommand)
registerCommand(deleteMonthlySettlementCommand)
registerCommand(createMonthlyDocumentCommand)
registerCommand(deleteMonthlyDocumentCommand)
