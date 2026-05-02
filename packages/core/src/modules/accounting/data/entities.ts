import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/core'
import type { AccountingInvoiceKind } from '../lib/constants'

export type AccountingInvoiceLineItem = {
  name: string
  unit: string
  quantity: string
  unitPriceNet: string
  taxRate: string
}

@Entity({ tableName: 'accounting_invoices' })
@Index({ name: 'accounting_invoices_scope_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'accounting_invoices_kind_idx', properties: ['documentKind'] })
@Unique({ name: 'accounting_invoices_doc_number_unique', properties: ['organizationId', 'tenantId', 'documentNumber', 'documentKind'] })
export class AccountingInvoice {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'document_number', type: 'text' })
  documentNumber!: string

  @Property({ name: 'document_kind', type: 'text' })
  documentKind!: AccountingInvoiceKind

  /** Saved as draft (not finalized); shown in the Drafts tab on the accounting dashboard. */
  @Property({ name: 'is_draft', type: 'boolean', default: false })
  isDraft: boolean = false

  @Property({ name: 'issue_date', type: 'date' })
  issueDate!: Date

  @Property({ name: 'sales_date', type: 'date', nullable: true })
  salesDate?: Date | null

  @Property({ name: 'payment_due_date', type: 'date', nullable: true })
  paymentDueDate?: Date | null

  @Property({ name: 'payment_term_days', type: 'integer', nullable: true })
  paymentTermDays?: number | null

  @Property({ name: 'payment_method', type: 'text', nullable: true })
  paymentMethod?: string | null

  @Property({ name: 'payment_account', type: 'text', nullable: true })
  paymentAccount?: string | null

  @Property({ name: 'seller_entity_id', type: 'uuid', nullable: true })
  sellerEntityId?: string | null

  @Property({ name: 'seller_name', type: 'text', nullable: true })
  sellerName?: string | null

  @Property({ name: 'seller_nip', type: 'text', nullable: true })
  sellerNip?: string | null

  @Property({ name: 'seller_regon', type: 'text', nullable: true })
  sellerRegon?: string | null

  @Property({ name: 'seller_address', type: 'text', nullable: true })
  sellerAddress?: string | null

  @Property({ name: 'buyer_entity_id', type: 'uuid', nullable: true })
  buyerEntityId?: string | null

  @Property({ name: 'buyer_name', type: 'text', nullable: true })
  buyerName?: string | null

  @Property({ name: 'buyer_nip', type: 'text', nullable: true })
  buyerNip?: string | null

  @Property({ name: 'buyer_regon', type: 'text', nullable: true })
  buyerRegon?: string | null

  @Property({ name: 'buyer_address', type: 'text', nullable: true })
  buyerAddress?: string | null

  @Property({ name: 'line_items', type: 'jsonb', nullable: true })
  lineItems?: AccountingInvoiceLineItem[] | null

  @Property({ type: 'text', nullable: true })
  title?: string | null

  @Property({ name: 'counterparty_name', type: 'text', nullable: true })
  counterpartyName?: string | null

  @Property({ name: 'external_reference', type: 'text', nullable: true })
  externalReference?: string | null

  @Property({ name: 'currency_code', type: 'text', nullable: true })
  currencyCode?: string | null

  @Property({ name: 'total_amount', type: 'numeric', precision: 14, scale: 2, nullable: true })
  totalAmount?: string | null

  @Property({ name: 'source_system', type: 'text', nullable: true })
  sourceSystem?: string | null

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

export type AccountingSellingEntityBankAccount = {
  accountNumber: string
  label?: string | null
  /** ISO 4217, e.g. PLN, EUR */
  currencyCode?: string | null
  /** Default account for new invoices (at most one per company). */
  isDefault?: boolean | null
}

/**
 * Spółki sprzedające (konfigurowane w Ustawieniach księgowości) — dane na fakturze i numery.
 */
@Entity({ tableName: 'accounting_selling_entities' })
@Index({ name: 'accounting_selling_entities_scope_idx', properties: ['organizationId', 'tenantId'] })
export class AccountingSellingEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ type: 'text' })
  name!: string

  @Property({ type: 'text', nullable: true })
  nip?: string | null

  @Property({ type: 'text', nullable: true })
  regon?: string | null

  @Property({ type: 'text', nullable: true })
  address?: string | null

  @Property({ name: 'bank_accounts', type: 'jsonb', nullable: true })
  bankAccounts?: AccountingSellingEntityBankAccount[] | null

  @Property({ name: 'invoice_numbering_mode', type: 'text' })
  invoiceNumberingMode!: string

  @Property({ name: 'invoice_numbering_custom', type: 'text', nullable: true })
  invoiceNumberingCustom?: string | null

  @Property({ name: 'next_invoice_seq', type: 'integer' })
  nextInvoiceSeq: number = 1

  @Property({ name: 'invoice_seq_year', type: 'integer', nullable: true })
  invoiceSeqYear?: number | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}
