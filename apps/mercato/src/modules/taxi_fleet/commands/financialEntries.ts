import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { requireId } from '@open-mercato/shared/lib/commands/helpers'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetFinancialEntry } from '../data/entities'
import {
  financialEntryCreateSchema,
  financialEntryDeleteSchema,
  financialEntryUpdateSchema,
  type FinancialEntryCreateInput,
  type FinancialEntryUpdateInput,
} from '../data/validators'
import { normalizeExpenseVatRatePercent } from '../lib/expenseVat'
import {
  assertFinancialEntryDriver,
  resolveFinancialEntryCustomer,
} from '../lib/financialEntryCustomer'
import {
  recalculateWeeklySettlementsForFinancialEntry,
  resolveFinancialEntryWeekStart,
} from '../lib/settlementWeekScope'
import { ensureOrganizationScope, ensureTenantScope, numericToString } from './shared'
import { syncFinancialEntryDocumentDuplicates } from '../lib/documentDuplicates'

const createFinancialEntryCommand: CommandHandler<FinancialEntryCreateInput, { entryId: string }> = {
  id: 'taxi_fleet.financial_entries.create',
  async execute(input, ctx) {
    const parsed = financialEntryCreateSchema.parse(input)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    await assertFinancialEntryDriver(em, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      teamMemberId: parsed.teamMemberId,
    })
    const customer = await resolveFinancialEntryCustomer(em, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      teamMemberId: parsed.teamMemberId,
      kind: parsed.kind,
      tripId: parsed.tripId ?? null,
      customerPersonId: parsed.customerPersonId ?? null,
      customerCompanyId: parsed.customerCompanyId ?? null,
      customerEntityId: parsed.customerEntityId ?? null,
    })
    const now = new Date()
    const record = em.create(TaxiFleetFinancialEntry, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      teamMemberId: parsed.teamMemberId,
      kind: parsed.kind,
      incomeDocumentType: parsed.kind === 'income' ? parsed.incomeDocumentType ?? null : null,
      costType: parsed.kind === 'expense' ? parsed.costType ?? null : null,
      tripId: customer.tripId,
      customerPersonId: customer.customerPersonId,
      customerCompanyId: customer.customerCompanyId,
      amount: numericToString(parsed.amount),
      vatRatePercent: numericToString(
        parsed.kind === 'expense'
          ? normalizeExpenseVatRatePercent(parsed.vatRatePercent)
          : normalizeExpenseVatRatePercent(23),
      ),
      currencyCode: parsed.currencyCode ?? 'PLN',
      documentNumber: parsed.documentNumber ?? null,
      isDocumentDuplicate: false,
      occurredAt: parsed.occurredAt,
      receiptAttachmentId: parsed.receiptAttachmentId ?? null,
      notes: parsed.notes ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    await em.persistAndFlush(record)
    await syncFinancialEntryDocumentDuplicates(em, record)
    await recalculateWeeklySettlementsForFinancialEntry(em, record)
    const eventBus = ctx.container.resolve('eventBus') as { emitEvent: (event: string, data: unknown) => Promise<void> }
    await eventBus.emitEvent('taxi_fleet.financial_entry.created', {
      id: record.id,
      tenantId: record.tenantId,
      organizationId: record.organizationId,
      teamMemberId: record.teamMemberId,
      kind: record.kind,
      incomeDocumentType: record.incomeDocumentType ?? null,
      costType: record.costType ?? null,
      amount: record.amount,
      currencyCode: record.currencyCode,
      documentNumber: record.documentNumber ?? null,
      occurredAt: record.occurredAt.toISOString(),
    })
    return { entryId: record.id }
  },
}

const updateFinancialEntryCommand: CommandHandler<FinancialEntryUpdateInput, { entryId: string }> = {
  id: 'taxi_fleet.financial_entries.update',
  async execute(input, ctx) {
    const parsed = financialEntryUpdateSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, TaxiFleetFinancialEntry, { id: parsed.id, deletedAt: null })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)

    const previousWeekStart = resolveFinancialEntryWeekStart(row.occurredAt)

    const customer = await resolveFinancialEntryCustomer(em, {
      tenantId: row.tenantId,
      organizationId: row.organizationId,
      teamMemberId: row.teamMemberId,
      kind: row.kind,
      tripId: parsed.tripId !== undefined ? parsed.tripId : row.tripId ?? null,
      customerPersonId:
        parsed.customerPersonId !== undefined ? parsed.customerPersonId : row.customerPersonId ?? null,
      customerCompanyId:
        parsed.customerCompanyId !== undefined ? parsed.customerCompanyId : row.customerCompanyId ?? null,
      customerEntityId: parsed.customerEntityId ?? null,
    })

    if (parsed.incomeDocumentType !== undefined && row.kind === 'income') {
      row.incomeDocumentType = parsed.incomeDocumentType
    }
    if (parsed.costType !== undefined && row.kind === 'expense') {
      row.costType = parsed.costType
    }
    if (parsed.tripId !== undefined || parsed.customerEntityId !== undefined) {
      row.tripId = customer.tripId
      row.customerPersonId = customer.customerPersonId
      row.customerCompanyId = customer.customerCompanyId
    }
    if (parsed.amount !== undefined) row.amount = numericToString(parsed.amount)
    if (parsed.vatRatePercent !== undefined && row.kind === 'expense') {
      row.vatRatePercent = numericToString(normalizeExpenseVatRatePercent(parsed.vatRatePercent))
    }
    if (parsed.currencyCode !== undefined) row.currencyCode = parsed.currencyCode
    if (parsed.documentNumber !== undefined) row.documentNumber = parsed.documentNumber
    if (parsed.occurredAt !== undefined) row.occurredAt = parsed.occurredAt
    if (parsed.receiptAttachmentId !== undefined) row.receiptAttachmentId = parsed.receiptAttachmentId
    if (parsed.notes !== undefined) row.notes = parsed.notes
    row.updatedAt = new Date()
    await em.flush()
    await syncFinancialEntryDocumentDuplicates(em, row)
    await recalculateWeeklySettlementsForFinancialEntry(em, row, previousWeekStart)
    return { entryId: row.id }
  },
}

const deleteFinancialEntryCommand: CommandHandler<{ id: string }, { ok: true }> = {
  id: 'taxi_fleet.financial_entries.delete',
  async execute(input, ctx) {
    const parsed = financialEntryDeleteSchema.parse(input)
    const id = requireId(parsed.id)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, TaxiFleetFinancialEntry, { id, deletedAt: null })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)
    const previousWeekStart = resolveFinancialEntryWeekStart(row.occurredAt)
    row.deletedAt = new Date()
    await em.flush()
    await recalculateWeeklySettlementsForFinancialEntry(em, row, previousWeekStart)
    return { ok: true }
  },
}

registerCommand(createFinancialEntryCommand)
registerCommand(updateFinancialEntryCommand)
registerCommand(deleteFinancialEntryCommand)
