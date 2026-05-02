import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { emitCrudSideEffects } from '@open-mercato/shared/lib/commands/helpers'
import type { CrudEventsConfig, CrudIndexerConfig } from '@open-mercato/shared/lib/crud/types'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import { AccountingInvoice, AccountingSellingEntity } from '../data/entities'
import { getNextDocumentNumberForIssueDate } from '../lib/invoiceNumbering'
import {
  accountingInvoiceCreateSchema,
  accountingInvoiceDeleteSchema,
  accountingInvoiceUpdateSchema,
  type AccountingInvoiceCreateInput,
  type AccountingInvoiceDeleteInput,
  type AccountingInvoiceUpdateInput,
} from '../data/validators'
import { ACCOUNTING_INVOICE_ENTITY_ID } from '../lib/constants'

const invoiceCrudEvents: CrudEventsConfig = {
  module: 'accounting',
  entity: 'invoice',
  persistent: true,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    organizationId: ctx.identifiers.organizationId,
    tenantId: ctx.identifiers.tenantId,
  }),
}

const invoiceCrudIndexer: CrudIndexerConfig = {
  entityType: ACCOUNTING_INVOICE_ENTITY_ID,
}

const createInvoiceCommand: CommandHandler<AccountingInvoiceCreateInput, { invoiceId: string }> = {
  id: 'accounting.invoices.create',
  async execute(input, ctx) {
    const parsed = accountingInvoiceCreateSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()

    const existing = await em.findOne(AccountingInvoice, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      documentNumber: parsed.documentNumber,
      documentKind: parsed.documentKind,
      deletedAt: null,
    })
    if (existing) {
      throw new CrudHttpError(409, { error: 'Invoice with this number and type already exists' })
    }

    const record = em.create(AccountingInvoice, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      documentNumber: parsed.documentNumber,
      documentKind: parsed.documentKind,
      isDraft: Boolean(parsed.isDraft),
      issueDate: new Date(parsed.issueDate),
      salesDate: parsed.salesDate ? new Date(parsed.salesDate) : null,
      paymentDueDate: parsed.paymentDueDate ? new Date(parsed.paymentDueDate) : null,
      paymentTermDays: parsed.paymentTermDays ?? null,
      paymentMethod: parsed.paymentMethod ?? null,
      paymentAccount: parsed.paymentAccount ?? null,
      sellerEntityId: parsed.sellerEntityId ?? null,
      sellerName: parsed.sellerName ?? null,
      sellerNip: parsed.sellerNip ?? null,
      sellerRegon: parsed.sellerRegon ?? null,
      sellerAddress: parsed.sellerAddress ?? null,
      buyerEntityId: parsed.buyerEntityId ?? null,
      buyerName: parsed.buyerName ?? null,
      buyerNip: parsed.buyerNip ?? null,
      buyerRegon: parsed.buyerRegon ?? null,
      buyerAddress: parsed.buyerAddress ?? null,
      lineItems: parsed.lineItems ?? null,
      title: parsed.title ?? null,
      counterpartyName: parsed.counterpartyName ?? parsed.buyerName ?? null,
      externalReference: parsed.externalReference ?? null,
      currencyCode: parsed.currencyCode ?? null,
      totalAmount: parsed.totalAmount ?? null,
      sourceSystem: parsed.sourceSystem ?? null,
      notes: parsed.notes ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    await em.persistAndFlush(record)

    if (parsed.sellerEntityId && parsed.documentKind === 'issued' && !parsed.isDraft) {
      const ent = await em.findOne(AccountingSellingEntity, {
        id: parsed.sellerEntityId,
        organizationId: parsed.organizationId,
        tenantId: parsed.tenantId,
        deletedAt: null,
      })
      if (ent) {
        const expected = getNextDocumentNumberForIssueDate(
          ent.invoiceNumberingMode,
          ent.invoiceNumberingCustom,
          ent.nextInvoiceSeq,
          ent.invoiceSeqYear ?? null,
          parsed.issueDate,
        )
        if (expected.documentNumber.trim() === parsed.documentNumber.trim()) {
          ent.nextInvoiceSeq = expected.seq + 1
          const mode = ent.invoiceNumberingMode
          if (mode === 'fv_year_seq' || mode === 'year_seq' || mode === 'custom') {
            ent.invoiceSeqYear = expected.year
          }
          ent.updatedAt = new Date()
          await em.persistAndFlush(ent)
        }
      }
    }

    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'created',
      entity: record,
      identifiers: {
        id: record.id,
        organizationId: record.organizationId,
        tenantId: record.tenantId,
      },
      events: invoiceCrudEvents,
      indexer: invoiceCrudIndexer,
    })

    return { invoiceId: record.id }
  },
}

const updateInvoiceCommand: CommandHandler<AccountingInvoiceUpdateInput, { ok: true }> = {
  id: 'accounting.invoices.update',
  async execute(input, ctx) {
    const parsed = accountingInvoiceUpdateSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()

    const record = await em.findOne(AccountingInvoice, { id: parsed.id, deletedAt: null })
    if (!record) throw new CrudHttpError(404, { error: 'Invoice not found' })

    if (parsed.documentNumber !== undefined) record.documentNumber = parsed.documentNumber
    if (parsed.documentKind !== undefined) record.documentKind = parsed.documentKind
    if (parsed.issueDate !== undefined) record.issueDate = new Date(parsed.issueDate)
    if (parsed.salesDate !== undefined) record.salesDate = parsed.salesDate ? new Date(parsed.salesDate) : null
    if (parsed.paymentDueDate !== undefined) {
      record.paymentDueDate = parsed.paymentDueDate ? new Date(parsed.paymentDueDate) : null
    }
    if (parsed.paymentTermDays !== undefined) record.paymentTermDays = parsed.paymentTermDays
    if (parsed.paymentMethod !== undefined) record.paymentMethod = parsed.paymentMethod
    if (parsed.paymentAccount !== undefined) record.paymentAccount = parsed.paymentAccount
    if (parsed.sellerEntityId !== undefined) record.sellerEntityId = parsed.sellerEntityId
    if (parsed.sellerName !== undefined) record.sellerName = parsed.sellerName
    if (parsed.sellerNip !== undefined) record.sellerNip = parsed.sellerNip
    if (parsed.sellerRegon !== undefined) record.sellerRegon = parsed.sellerRegon
    if (parsed.sellerAddress !== undefined) record.sellerAddress = parsed.sellerAddress
    if (parsed.buyerEntityId !== undefined) record.buyerEntityId = parsed.buyerEntityId
    if (parsed.buyerName !== undefined) record.buyerName = parsed.buyerName
    if (parsed.buyerNip !== undefined) record.buyerNip = parsed.buyerNip
    if (parsed.buyerRegon !== undefined) record.buyerRegon = parsed.buyerRegon
    if (parsed.buyerAddress !== undefined) record.buyerAddress = parsed.buyerAddress
    if (parsed.lineItems !== undefined) record.lineItems = parsed.lineItems
    if (parsed.title !== undefined) record.title = parsed.title
    if (parsed.counterpartyName !== undefined) record.counterpartyName = parsed.counterpartyName
    if (parsed.externalReference !== undefined) record.externalReference = parsed.externalReference
    if (parsed.currencyCode !== undefined) record.currencyCode = parsed.currencyCode
    if (parsed.totalAmount !== undefined) record.totalAmount = parsed.totalAmount
    if (parsed.sourceSystem !== undefined) record.sourceSystem = parsed.sourceSystem
    if (parsed.notes !== undefined) record.notes = parsed.notes
    if (parsed.isDraft !== undefined) record.isDraft = parsed.isDraft
    record.updatedAt = new Date()

    await em.persistAndFlush(record)

    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'updated',
      entity: record,
      identifiers: {
        id: record.id,
        organizationId: record.organizationId,
        tenantId: record.tenantId,
      },
      events: invoiceCrudEvents,
      indexer: invoiceCrudIndexer,
    })

    return { ok: true as const }
  },
}

const deleteInvoiceCommand: CommandHandler<AccountingInvoiceDeleteInput, { ok: true }> = {
  id: 'accounting.invoices.delete',
  async execute(input, ctx) {
    const parsed = accountingInvoiceDeleteSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()

    const where: Record<string, unknown> = { id: parsed.id, deletedAt: null }
    if (parsed.organizationId) where.organizationId = parsed.organizationId
    if (parsed.tenantId) where.tenantId = parsed.tenantId
    const record = await em.findOne(AccountingInvoice, where)
    if (!record) throw new CrudHttpError(404, { error: 'Invoice not found' })

    record.deletedAt = new Date()
    record.updatedAt = new Date()
    await em.persistAndFlush(record)

    const dataEngine = ctx.container.resolve('dataEngine') as DataEngine
    await emitCrudSideEffects({
      dataEngine,
      action: 'deleted',
      entity: record,
      identifiers: {
        id: record.id,
        organizationId: record.organizationId,
        tenantId: record.tenantId,
      },
      events: invoiceCrudEvents,
      indexer: invoiceCrudIndexer,
    })

    return { ok: true as const }
  },
}

registerCommand(createInvoiceCommand)
registerCommand(updateInvoiceCommand)
registerCommand(deleteInvoiceCommand)
