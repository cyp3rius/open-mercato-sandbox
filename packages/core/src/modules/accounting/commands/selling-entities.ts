import { registerCommand } from '@open-mercato/shared/lib/commands'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { AccountingSellingEntity } from '../data/entities'
import {
  accountingSellingEntityCreateSchema,
  accountingSellingEntityDeleteSchema,
  accountingSellingEntityUpdateSchema,
  type AccountingSellingEntityCreateInput,
  type AccountingSellingEntityDeleteInput,
  type AccountingSellingEntityUpdateInput,
} from '../data/validators'
import { normalizeBankAccountLinesAtMostOneDefault } from '../lib/bankAccountsNormalize'

const createSellingEntityCommand: CommandHandler<AccountingSellingEntityCreateInput, { sellingEntityId: string }> = {
  id: 'accounting.selling_entities.create',
  async execute(input, ctx) {
    const parsed = accountingSellingEntityCreateSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const y = new Date().getFullYear()
    const bankAccounts = Array.isArray(parsed.bankAccounts)
      ? normalizeBankAccountLinesAtMostOneDefault(parsed.bankAccounts)
      : null
    const record = em.create(AccountingSellingEntity, {
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      name: parsed.name,
      nip: parsed.nip?.trim() ? parsed.nip : null,
      regon: parsed.regon?.trim() ? parsed.regon : null,
      address: parsed.address?.trim() ? parsed.address : null,
      bankAccounts,
      invoiceNumberingMode: parsed.invoiceNumberingMode,
      invoiceNumberingCustom: parsed.invoiceNumberingCustom?.trim() ? parsed.invoiceNumberingCustom : null,
      nextInvoiceSeq: 1,
      invoiceSeqYear: ['fv_year_seq', 'year_seq', 'custom'].includes(parsed.invoiceNumberingMode) ? y : null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })
    await em.persistAndFlush(record)
    return { sellingEntityId: record.id }
  },
}

const updateSellingEntityCommand: CommandHandler<AccountingSellingEntityUpdateInput, { ok: true }> = {
  id: 'accounting.selling_entities.update',
  async execute(input, ctx) {
    const parsed = accountingSellingEntityUpdateSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const record = await em.findOne(AccountingSellingEntity, {
      id: parsed.id,
      organizationId: parsed.organizationId,
      tenantId: parsed.tenantId,
      deletedAt: null,
    })
    if (!record) {
      throw new CrudHttpError(404, { error: 'Selling entity not found' })
    }
    if (parsed.name !== undefined) record.name = parsed.name
    if (parsed.nip !== undefined) record.nip = parsed.nip?.trim() ? parsed.nip : null
    if (parsed.regon !== undefined) record.regon = parsed.regon?.trim() ? parsed.regon : null
    if (parsed.address !== undefined) record.address = parsed.address?.trim() ? parsed.address : null
    if (parsed.bankAccounts !== undefined) {
      record.bankAccounts = Array.isArray(parsed.bankAccounts)
        ? normalizeBankAccountLinesAtMostOneDefault(parsed.bankAccounts)
        : parsed.bankAccounts
    }
    if (parsed.invoiceNumberingMode !== undefined) record.invoiceNumberingMode = parsed.invoiceNumberingMode
    if (parsed.invoiceNumberingCustom !== undefined) {
      record.invoiceNumberingCustom = parsed.invoiceNumberingCustom?.trim() ? parsed.invoiceNumberingCustom : null
    }
    if (parsed.invoiceNumberingMode === 'custom' && !String(record.invoiceNumberingCustom ?? '').trim()) {
      throw new CrudHttpError(400, { error: 'Custom numbering template is required' })
    }
    record.updatedAt = new Date()
    await em.flush()
    return { ok: true }
  },
}

const deleteSellingEntityCommand: CommandHandler<AccountingSellingEntityDeleteInput, { ok: true }> = {
  id: 'accounting.selling_entities.delete',
  async execute(input, ctx) {
    const parsed = accountingSellingEntityDeleteSchema.parse(input)
    if (!parsed.id) {
      throw new CrudHttpError(400, { error: 'id is required' })
    }
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const where: Record<string, unknown> = { id: parsed.id, deletedAt: null }
    if (parsed.organizationId) where.organizationId = parsed.organizationId
    if (parsed.tenantId) where.tenantId = parsed.tenantId
    const record = await em.findOne(AccountingSellingEntity, where)
    if (!record) {
      throw new CrudHttpError(404, { error: 'Selling entity not found' })
    }
    record.deletedAt = new Date()
    record.updatedAt = new Date()
    await em.flush()
    return { ok: true }
  },
}

registerCommand(createSellingEntityCommand)
registerCommand(updateSellingEntityCommand)
registerCommand(deleteSellingEntityCommand)
