import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetWeeklySettlement } from '../data/entities'
import {
  settlementGenerateSchema,
  settlementSubmitSchema,
  settlementUpdateSchema,
  type SettlementGenerateInput,
  type SettlementSubmitInput,
  type SettlementUpdateInput,
} from '../data/validators'
import { formatDistanceKm } from '../lib/settlementTripDistance'
import {
  parseSettlementCostExclusions,
  type SettlementCostExclusion,
} from '../lib/settlementCostExclusions'
import { assertTeamMemberHasDriverProfile } from '../lib/driverProfileGuard'
import { resolveDriverContext } from '../lib/driverContext'
import {
  applyWeeklySettlementRecalculation,
  isSettlementClosureUpdate,
  isSettlementStatusOnlyUpdate,
  recomputeSettlementTransfer,
  syncSettlementPayoutPercentFromDriverProfile,
} from '../lib/settlementRecalculation'
import { isWeeklySettlementLocked } from '../lib/settlementLock'
import { isAllowedWeeklySettlementStatusTransition } from '../lib/settlementStatusTransitions'
import { assertWeeklySettlementDocumentNumbersComplete } from '../lib/settlementDocumentNumberGate'
import { ensureOrganizationScope, ensureTenantScope, numericToString } from './shared'

async function emitSettlementEvent(
  ctx: { container: { resolve: (name: string) => unknown } },
  eventId: string,
  row: TaxiFleetWeeklySettlement,
) {
  const eventBus = ctx.container.resolve('eventBus') as { emitEvent: (event: string, data: unknown) => Promise<void> }
  await eventBus.emitEvent(eventId, {
    id: row.id,
    tenantId: row.tenantId,
    organizationId: row.organizationId,
    teamMemberId: row.teamMemberId,
    weekStart: row.weekStart,
    status: row.status,
  })
}

function mergeSettlementCostExclusions(
  row: TaxiFleetWeeklySettlement,
  items: Array<{ financialEntryId: string; comment: string }>,
): SettlementCostExclusion[] {
  const existingExclusions = parseSettlementCostExclusions(row.snapshotJson)
  return items.map((item) => {
    const previous = existingExclusions.find((entry) => entry.financialEntryId === item.financialEntryId)
    return {
      financialEntryId: item.financialEntryId,
      comment: item.comment.trim(),
      excludedAt: previous?.excludedAt ?? new Date().toISOString(),
    }
  })
}

function applySettlementStatusChange(
  row: TaxiFleetWeeklySettlement,
  status: SettlementUpdateInput['status'],
  ctx: Parameters<CommandHandler<SettlementUpdateInput, { settlementId: string }>['execute']>[1],
): void {
  if (status === undefined) return
  row.status = status
  if (status === 'approved') {
    row.approvedAt = new Date()
    row.approvedByUserId = ctx.auth?.sub ?? null
  }
  if (status === 'submitted') row.submittedAt = new Date()
}

const generateSettlementCommand: CommandHandler<SettlementGenerateInput, { settlementId: string }> = {
  id: 'taxi_fleet.settlements.generate_week',
  async execute(input, ctx) {
    const parsed = settlementGenerateSchema.parse(input)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const existing = await findOneWithDecryption(
      em,
      TaxiFleetWeeklySettlement,
      {
        tenantId: parsed.tenantId,
        organizationId: parsed.organizationId,
        teamMemberId: parsed.teamMemberId,
        weekStart: parsed.weekStart,
        deletedAt: null,
      },
      undefined,
      { tenantId: parsed.tenantId, organizationId: parsed.organizationId },
    )
    if (existing) {
      const { translate } = await resolveTranslations()
      throw new CrudHttpError(409, { error: translate('taxi_fleet.errors.settlementExists', 'Settlement already exists for this week.') })
    }
    const { translate } = await resolveTranslations()
    await assertTeamMemberHasDriverProfile(em, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      teamMemberId: parsed.teamMemberId,
      translate,
    })
    const now = new Date()
    const record = em.create(TaxiFleetWeeklySettlement, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      teamMemberId: parsed.teamMemberId,
      weekStart: parsed.weekStart,
      payoutPercent: '0',
      cashCollected: '0',
      bonusAmount: '0',
      compensationAmount: '0',
      airportA4Amount: '0',
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    em.persist(record)
    await syncSettlementPayoutPercentFromDriverProfile(em, record)
    await applyWeeklySettlementRecalculation(em, record)
    record.cashCollected = record.cashExpected
    recomputeSettlementTransfer(record)
    await em.flush()
    return { settlementId: record.id }
  },
}

const updateSettlementCommand: CommandHandler<SettlementUpdateInput, { settlementId: string }> = {
  id: 'taxi_fleet.settlements.update',
  async execute(input, ctx) {
    const parsed = settlementUpdateSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, TaxiFleetWeeklySettlement, { id: parsed.id, deletedAt: null })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)

    const previousStatus = row.status
    const closureUpdate = isSettlementClosureUpdate(parsed)
    const statusOnly = isSettlementStatusOnlyUpdate(parsed)

    if (parsed.status !== undefined && parsed.status !== row.status) {
      if (!isAllowedWeeklySettlementStatusTransition(row.status, parsed.status)) {
        const { translate } = await resolveTranslations()
        throw new CrudHttpError(409, {
          error: translate(
            'taxi_fleet.errors.settlementStatusTransition',
            'This status change is not allowed.',
          ),
        })
      }
      if (parsed.status === 'approved') {
        const gate = await assertWeeklySettlementDocumentNumbersComplete(em, {
          tenantId: row.tenantId,
          organizationId: row.organizationId,
          teamMemberId: row.teamMemberId,
          weekStart: row.weekStart,
        })
        if (!gate.ok) {
          const { translate } = await resolveTranslations()
          throw new CrudHttpError(409, {
            error: translate(
              'taxi_fleet.errors.settlementMissingDocumentNumbers',
              'Cannot approve settlement: some trips are missing receipt document numbers.',
            ),
            details: { missingTripIds: gate.missingTripIds },
          })
        }
      }
    }

    if (closureUpdate) {
      if (row.status !== 'approved') {
        const { translate } = await resolveTranslations()
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
      applySettlementStatusChange(row, 'paid', ctx)
    } else if (!statusOnly && isWeeklySettlementLocked(row.status)) {
      const { translate } = await resolveTranslations()
      throw new CrudHttpError(409, {
        error: translate(
          'taxi_fleet.errors.settlementLocked',
          'Approved settlements cannot be modified. Change the status first if you need to edit amounts or costs.',
        ),
      })
    } else if (statusOnly) {
      applySettlementStatusChange(row, parsed.status, ctx)
    } else {
      if (parsed.totalDistanceKm !== undefined) {
        row.totalDistanceKm = formatDistanceKm(parsed.totalDistanceKm)
      }
      if (parsed.cashCollected !== undefined) row.cashCollected = numericToString(parsed.cashCollected)
      if (parsed.bonusAmount !== undefined) row.bonusAmount = numericToString(parsed.bonusAmount)
      if (parsed.compensationAmount !== undefined) row.compensationAmount = numericToString(parsed.compensationAmount)
      if (parsed.airportA4Amount !== undefined) row.airportA4Amount = numericToString(parsed.airportA4Amount)

      await syncSettlementPayoutPercentFromDriverProfile(em, row)

      const excludedCosts =
        parsed.excludedCosts !== undefined ? mergeSettlementCostExclusions(row, parsed.excludedCosts) : undefined

      await applyWeeklySettlementRecalculation(em, row, {
        syncTotalDistance: parsed.recalculateSettlement === true || parsed.recalculateDistance === true,
        excludedCosts,
      })

      applySettlementStatusChange(row, parsed.status, ctx)
    }

    await em.flush()
    if (previousStatus !== 'submitted' && row.status === 'submitted') {
      await emitSettlementEvent(ctx, 'taxi_fleet.settlement.submitted', row)
    }
    if (previousStatus !== 'approved' && row.status === 'approved') {
      await emitSettlementEvent(ctx, 'taxi_fleet.settlement.approved', row)
    }
    return { settlementId: row.id }
  },
}

const submitSettlementCommand: CommandHandler<
  SettlementSubmitInput & { teamMemberId?: string },
  { settlementId: string }
> = {
  id: 'taxi_fleet.settlements.submit',
  async execute(input, ctx) {
    const parsed = settlementSubmitSchema.parse(input)
    const { translate } = await resolveTranslations()
    const driver = await resolveDriverContext(ctx, translate)
    const teamMemberId = input.teamMemberId ?? driver.teamMemberId
    const tenantId = driver.teamMember.tenantId
    const organizationId = driver.teamMember.organizationId
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    let row = await findOneWithDecryption(
      em,
      TaxiFleetWeeklySettlement,
      { tenantId, organizationId, teamMemberId, weekStart: parsed.weekStart, deletedAt: null },
      undefined,
      { tenantId, organizationId },
    )
    if (!row) {
      const generated = await generateSettlementCommand.execute(
        { tenantId, organizationId, teamMemberId, weekStart: parsed.weekStart },
        ctx,
      )
      row = await findOneWithDecryption(em, TaxiFleetWeeklySettlement, { id: generated.settlementId })
      if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    }

    await syncSettlementPayoutPercentFromDriverProfile(em, row)
    await applyWeeklySettlementRecalculation(em, row)

    row.status = 'submitted'
    row.submittedAt = new Date()
    await em.flush()
    await emitSettlementEvent(ctx, 'taxi_fleet.settlement.submitted', row)
    return { settlementId: row.id }
  },
}

registerCommand(generateSettlementCommand)
registerCommand(updateSettlementCommand)
registerCommand(submitSettlementCommand)
