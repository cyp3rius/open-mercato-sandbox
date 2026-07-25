import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { EventBus } from '@open-mercato/events'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { SalesOrder } from '../../sales/data/entities'
import {
  PartnerIncentiveLedgerEntry,
  PartnerProgram,
  PartnerProgramMembership,
} from '../data/entities'
import {
  partnerIncentiveAccrueForOrderSchema,
  partnerIncentivePayoutSchema,
  type PartnerIncentiveAccrueForOrderInput,
  type PartnerIncentivePayoutInput,
} from '../data/validators'
import {
  calculateIncentiveAmount,
  parseIncentivePercent,
  resolveIncentiveProgram,
  resolveOrderIncentiveBaseAmount,
  summarizeLedgerBalances,
  toStoredAmount,
  type ProgramCandidateForIncentive,
} from '../lib/incentiveCalculation'
import { ensureOrganizationScope, ensureTenantScope } from './shared'

export type AccrueForOrderResult = {
  skipped: boolean
  reason?: string
  entryId?: string
  amount?: string
  currencyCode?: string
}

async function loadLedgerEntriesForPartner(
  em: EntityManager,
  params: { customerEntityId: string; organizationId: string; tenantId: string; currencyCode?: string },
): Promise<PartnerIncentiveLedgerEntry[]> {
  return em.find(PartnerIncentiveLedgerEntry, {
    customerEntityId: params.customerEntityId,
    organizationId: params.organizationId,
    tenantId: params.tenantId,
    deletedAt: null,
    ...(params.currencyCode ? { currencyCode: params.currencyCode } : {}),
  })
}

const accrueForOrderCommand: CommandHandler<
  PartnerIncentiveAccrueForOrderInput,
  AccrueForOrderResult
> = {
  id: 'partner_programs.incentives.accrue_for_order',
  async execute(rawInput, ctx) {
    const parsed = partnerIncentiveAccrueForOrderSchema.parse(rawInput)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const order = await em.findOne(SalesOrder, { id: parsed.orderId, deletedAt: null })
    if (!order) {
      return { skipped: true, reason: 'order_not_found' }
    }
    const tenantId = parsed.tenantId ?? order.tenantId
    const organizationId = parsed.organizationId ?? order.organizationId
    if (ctx.auth?.tenantId) ensureTenantScope(ctx, tenantId)
    if (ctx.auth?.orgId || ctx.selectedOrganizationId) ensureOrganizationScope(ctx, organizationId)

    const partnerId = order.referringPartnerEntityId?.trim() ?? ''
    if (!partnerId) {
      return { skipped: true, reason: 'no_referring_partner' }
    }

    const existing = await em.findOne(PartnerIncentiveLedgerEntry, {
      salesOrderId: order.id,
      kind: 'accrual',
      deletedAt: null,
    })
    if (existing) {
      return {
        skipped: true,
        reason: 'already_accrued',
        entryId: existing.id,
        amount: existing.amount,
        currencyCode: existing.currencyCode,
      }
    }

    const memberships = await em.find(
      PartnerProgramMembership,
      {
        customerEntityId: partnerId,
        organizationId,
        tenantId,
        deletedAt: null,
      },
      { populate: ['program'] },
    )
    const onDate = order.placedAt ?? order.createdAt ?? new Date()
    const candidates: ProgramCandidateForIncentive[] = []
    for (const membership of memberships) {
      const program =
        typeof membership.program === 'object' && membership.program
          ? membership.program
          : await em.findOne(PartnerProgram, {
              id: typeof membership.program === 'string' ? membership.program : '',
              deletedAt: null,
            })
      if (!program || program.deletedAt) continue
      candidates.push({
        programId: program.id,
        incentivePercent: parseIncentivePercent(program.incentivePercent),
        incentiveBase: program.incentiveBase === 'gross' ? 'gross' : 'net',
        isActive: program.isActive,
        validFrom: program.validFrom ?? null,
        validTo: program.validTo ?? null,
      })
    }
    const best = resolveIncentiveProgram(
      candidates,
      onDate,
      order.referringPartnerProgramId ?? null,
    )
    if (!best) {
      return { skipped: true, reason: 'no_eligible_program' }
    }

    const baseAmount = resolveOrderIncentiveBaseAmount(order, best.incentiveBase)
    const amount = calculateIncentiveAmount(baseAmount, best.incentivePercent)
    if (amount <= 0) {
      return { skipped: true, reason: 'zero_amount' }
    }

    const currencyCode = (order.currencyCode || 'EUR').trim().toUpperCase()
    const now = new Date()
    const entry = em.create(PartnerIncentiveLedgerEntry, {
      tenantId,
      organizationId,
      customerEntityId: partnerId,
      programId: best.programId,
      kind: 'accrual',
      amount: toStoredAmount(amount),
      currencyCode,
      salesOrderId: order.id,
      ratePercent: toStoredAmount(best.incentivePercent),
      baseAmount: toStoredAmount(baseAmount),
      note: null,
      createdByUserId: ctx.auth?.sub ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    em.persist(entry)
    try {
      await em.flush()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('partner_programs_incentive_ledger_order_accrual_uidx')) {
        return { skipped: true, reason: 'already_accrued' }
      }
      throw err
    }

    try {
      const events = ctx.container.resolve('eventBus') as EventBus
      await events.emit('partner_programs.incentive.accrued', {
        id: entry.id,
        organizationId,
        tenantId,
        customerEntityId: partnerId,
        salesOrderId: order.id,
        amount: entry.amount,
        currencyCode,
      })
    } catch (err) {
      console.error('partner_programs.incentive.accrued emit failed', err)
    }

    return {
      skipped: false,
      entryId: entry.id,
      amount: entry.amount,
      currencyCode,
    }
  },
}

const createPayoutCommand: CommandHandler<
  PartnerIncentivePayoutInput,
  { entryId: string; amount: string; currencyCode: string }
> = {
  id: 'partner_programs.incentives.create_payout',
  async execute(rawInput, ctx) {
    const parsed = partnerIncentivePayoutSchema.parse(rawInput)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const { translate } = await resolveTranslations()
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const currencyCode = parsed.currencyCode.trim().toUpperCase()
    const entries = await loadLedgerEntriesForPartner(em, {
      customerEntityId: parsed.customerEntityId,
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      currencyCode,
    })
    const balances = summarizeLedgerBalances(
      entries.map((row) => ({
        kind: row.kind,
        amount: row.amount,
        currencyCode: row.currencyCode,
      })),
    )
    const balance = balances.find((row) => row.currencyCode === currencyCode)
    const payable = balance?.payable ?? 0
    if (payable <= 0) {
      throw new CrudHttpError(400, {
        error: translate(
          'partner_programs.incentives.errors.nothingToPayout',
          'There is no payable balance for this currency.',
        ),
      })
    }

    const now = new Date()
    const entry = em.create(PartnerIncentiveLedgerEntry, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      customerEntityId: parsed.customerEntityId,
      programId: null,
      kind: 'payout',
      amount: toStoredAmount(-payable),
      currencyCode,
      salesOrderId: null,
      ratePercent: null,
      baseAmount: null,
      note: parsed.note ?? null,
      createdByUserId: ctx.auth?.sub ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    em.persist(entry)
    await em.flush()

    try {
      const events = ctx.container.resolve('eventBus') as EventBus
      await events.emit('partner_programs.incentive.payout_created', {
        id: entry.id,
        organizationId: parsed.organizationId,
        tenantId: parsed.tenantId,
        customerEntityId: parsed.customerEntityId,
        amount: entry.amount,
        currencyCode,
      })
    } catch (err) {
      console.error('partner_programs.incentive.payout_created emit failed', err)
    }

    return { entryId: entry.id, amount: entry.amount, currencyCode }
  },
}

registerCommand(accrueForOrderCommand)
registerCommand(createPayoutCommand)
