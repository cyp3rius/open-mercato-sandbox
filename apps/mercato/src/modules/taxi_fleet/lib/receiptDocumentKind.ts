import type { ReceiptOcrFields } from './receiptOcrExtract'

/**
 * Detect Polcard (or clearly labeled) card-payment confirmation slips.
 * These are not fiscal receipts (paragon) but should still OCR-extract amounts.
 */
export function isPolcardPaymentConfirmation(
  fields: Pick<ReceiptOcrFields, 'documentKind' | 'rawExcerpt'>,
): boolean {
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
    /\bauth\.?\s*(code|kod)/i.test(excerpt)

  const hasFiscalMarkers =
    /paragon\s+fiskalny/i.test(excerpt) ||
    /nip\s+nabyw/i.test(excerpt) ||
    /\bfiskaln/i.test(excerpt)

  return hasTerminalCues && !hasFiscalMarkers
}

export function resolveReceiptDocumentKind(
  fields: Pick<ReceiptOcrFields, 'documentKind' | 'rawExcerpt'>,
): NonNullable<ReceiptOcrFields['documentKind']> {
  if (isPolcardPaymentConfirmation(fields)) return 'polcard_payment_confirmation'
  if (fields.documentKind && fields.documentKind !== 'unknown') return fields.documentKind
  return 'unknown'
}
