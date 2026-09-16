import type { ReceiptOcrFields } from './receiptOcrExtract'

/** Fiscal taxi / shop receipt markers (not card-terminal confirmations). */
export function excerptLooksLikeFiscalReceipt(excerpt: string | null | undefined): boolean {
  const text = (excerpt ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return false
  return (
    /paragon\s+fiskalny/i.test(text) ||
    /pocz[aą]tek\s+kursu/i.test(text) ||
    /koniec\s+kursu/i.test(text) ||
    /odleg[lł]o[sś][cć]\s+przejechana/i.test(text) ||
    /\bnip\s+nabyw/i.test(text) ||
    /\bsuma\s+ptu\b/i.test(text) ||
    /\bfiskaln/i.test(text)
  )
}

/**
 * Detect Polcard (or clearly labeled) card-payment confirmation slips.
 * These are not fiscal receipts (paragon) but may still OCR-extract amounts for expenses.
 *
 * When the same photo shows BOTH a fiscal receipt and a PolCard slip, prefer the
 * fiscal receipt — never treat the pair as “PolCard only”.
 */
export function isPolcardPaymentConfirmation(
  fields: Pick<ReceiptOcrFields, 'documentKind' | 'rawExcerpt'>,
): boolean {
  if (excerptLooksLikeFiscalReceipt(fields.rawExcerpt)) return false

  if (fields.documentKind === 'polcard_payment_confirmation') return true

  const excerpt = (fields.rawExcerpt ?? '').replace(/\s+/g, ' ').trim()
  if (/\bpolcard\b/i.test(excerpt)) return true

  if (fields.documentKind === 'payment_confirmation') return true

  if (!excerpt) return false

  const looksLikePaymentSlip =
    /potwierdzen\w*\s+p[łl]atno[śs]ci/i.test(excerpt) ||
    /potwierdzen\w*\s+transakcji/i.test(excerpt) ||
    /confirmation\s+of\s+payment/i.test(excerpt) ||
    /card\s+payment\s+confirmation/i.test(excerpt)

  if (!looksLikePaymentSlip) return false

  const hasTerminalCues =
    /\bterminal\b/i.test(excerpt) ||
    /\bkart(a|y|ą)\b/i.test(excerpt) ||
    /\bvisa\b|\bmastercard\b|\bmaestro\b/i.test(excerpt) ||
    /\bautoryzac/i.test(excerpt) ||
    /\bauth\.?\s*(code|kod)/i.test(excerpt) ||
    /\bcontactless\b/i.test(excerpt) ||
    /\bmid\s*:/i.test(excerpt) ||
    /\bpos\s*id\s*:/i.test(excerpt)

  return hasTerminalCues
}

export function resolveReceiptDocumentKind(
  fields: Pick<ReceiptOcrFields, 'documentKind' | 'rawExcerpt'>,
): NonNullable<ReceiptOcrFields['documentKind']> {
  // Dual-document photos (paragon + PolCard): always classify as fiscal receipt.
  if (excerptLooksLikeFiscalReceipt(fields.rawExcerpt)) {
    if (fields.documentKind === 'wz_slip') return 'wz_slip'
    return 'fiscal_receipt'
  }
  if (isPolcardPaymentConfirmation(fields)) return 'polcard_payment_confirmation'
  if (fields.documentKind === 'wz_slip') return 'wz_slip'
  const excerpt = fields.rawExcerpt ?? ''
  if (/\bkwit\s*wz\b|\bwz\s*[:/]|\bdokument\s+wz\b/i.test(excerpt)) return 'wz_slip'
  if (fields.documentKind && fields.documentKind !== 'unknown') return fields.documentKind
  return 'unknown'
}
