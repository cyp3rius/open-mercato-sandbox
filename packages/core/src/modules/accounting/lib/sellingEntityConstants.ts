/** Predefiniowane tryby numeracji faktury (UI + zapis w encji). */
export const ACCOUNTING_INVOICE_NUMBERING_MODE_IDS = ['fv_year_seq', 'year_seq', 'seq_only', 'custom'] as const
export type AccountingInvoiceNumberingModeId = (typeof ACCOUNTING_INVOICE_NUMBERING_MODE_IDS)[number]

export function isInvoiceNumberingModeId(value: string): value is AccountingInvoiceNumberingModeId {
  return (ACCOUNTING_INVOICE_NUMBERING_MODE_IDS as readonly string[]).includes(value)
}
