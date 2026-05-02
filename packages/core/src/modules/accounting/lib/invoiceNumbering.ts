import { isInvoiceNumberingModeId } from './sellingEntityConstants'

function padSeq(n: number, width: number): string {
  return String(n).padStart(width, '0')
}

/**
 * Przykładowy numer faktury (podgląd w ustawieniach) — używa bieżącego roku i `seq`.
 */
export function formatInvoiceNumberPreview(
  mode: string,
  customTemplate: string | null | undefined,
  year: number,
  seq: number,
): string {
  const m = isInvoiceNumberingModeId(mode) ? mode : 'seq_only'
  switch (m) {
    case 'fv_year_seq':
      return `FV/${year}/${padSeq(seq, 4)}`
    case 'year_seq':
      return `${year}/${padSeq(seq, 4)}`
    case 'seq_only':
      return padSeq(seq, 4)
    case 'custom': {
      const t = (customTemplate ?? '').trim()
      if (!t.length) return padSeq(seq, 4)
      return t
        .replace(/\{YYYY\}/g, String(year))
        .replace(/\{SEQ\}/g, String(seq))
        .replace(/\{SEQ:(\d+)\}/g, (_, w: string) => padSeq(seq, Number(w) || 1))
    }
    default:
      return padSeq(seq, 4)
  }
}

/**
 * Next invoice number for a selling entity and issue date.
 * Year-based modes reset sequence to 1 when the calendar year changes vs `invoiceSeqYear`.
 * `seq_only` keeps a single running counter (no year reset).
 */
export function getNextDocumentNumberForIssueDate(
  mode: string,
  custom: string | null | undefined,
  nextInvoiceSeq: number,
  invoiceSeqYear: number | null | undefined,
  issueDateIso: string,
): { documentNumber: string; seq: number; year: number } {
  const issue = new Date(issueDateIso)
  const y = Number.isNaN(issue.getTime()) ? new Date().getFullYear() : issue.getFullYear()
  const m = isInvoiceNumberingModeId(mode) ? mode : 'seq_only'
  let seq = nextInvoiceSeq
  if (m === 'seq_only') {
    const documentNumber = formatInvoiceNumberPreview(m, custom, y, seq)
    return { documentNumber, seq, year: y }
  }
  if (m === 'fv_year_seq' || m === 'year_seq' || m === 'custom') {
    if (invoiceSeqYear != null && invoiceSeqYear !== y) {
      seq = 1
    }
  }
  const documentNumber = formatInvoiceNumberPreview(m, custom, y, seq)
  return { documentNumber, seq, year: y }
}

