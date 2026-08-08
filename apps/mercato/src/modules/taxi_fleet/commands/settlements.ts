import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { requireId } from '@open-mercato/shared/lib/commands/helpers'
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
import { calculateWeeklySettlement } from '../lib/settlementCalculator'
import { assertTeamMemberHasDriverProfile } from '../lib/driverProfileGuard'
import { resolveDriverContext } from '../lib/driverContext'
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
    const profile = await assertTeamMemberHasDriverProfile(em, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      teamMemberId: parsed.teamMemberId,
      translate,
    })
    const payoutPercent = Number(profile.payoutPercent)
    const totals = await calculateWeeklySettlement(em, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      teamMemberId: parsed.teamMemberId,
      weekStart: parsed.weekStart,
      payoutPercent,
    })
    const now = new Date()
    const record = em.create(TaxiFleetWeeklySettlement, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      teamMemberId: parsed.teamMemberId,
      weekStart: parsed.weekStart,
      totalRevenue: numericToString(totals.totalRevenue),
      totalCosts: numericToString(totals.totalCosts),
      netAmount: numericToString(totals.netAmount),
      payoutPercent: numericToString(payoutPercent),
      payoutAmount: numericToString(totals.payoutAmount),
      status: 'draft',
      snapshotJson: { tripIds: totals.tripIds },
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    await em.persistAndFlush(record)
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
    if (parsed.status !== undefined) {
      row.status = parsed.status
      if (parsed.status === 'approved') {
        row.approvedAt = new Date()
        row.approvedByUserId = ctx.auth?.sub ?? null
      }
      if (parsed.status === 'submitted') row.submittedAt = new Date()
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
