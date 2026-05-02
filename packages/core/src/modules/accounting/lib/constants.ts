export const ACCOUNTING_INVOICE_ENTITY_ID = 'accounting:accounting_invoice'

export const ACCOUNTING_INVOICE_KINDS = ['issued', 'imported_cost', 'imported_sales'] as const

export type AccountingInvoiceKind = (typeof ACCOUNTING_INVOICE_KINDS)[number]
