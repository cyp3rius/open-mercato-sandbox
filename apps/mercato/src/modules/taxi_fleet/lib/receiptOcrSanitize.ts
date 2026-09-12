import { normalizeNipDigits } from '@open-mercato/core/modules/customers/lib/nip'
import type { ReceiptOcrFields } from './receiptOcrExtract'

/** RS Investment Group — seller NIP on RS Moto taxi fiscal receipts (paragon). */
export const RS_MOTO_ISSUER_NIP_DIGITS = '9452189152'

const KNOWN_FLEET_ISSUER_NIP_DIGITS = new Set([RS_MOTO_ISSUER_NIP_DIGITS])

/**
 * Accept Polish NIP in dashed or compact form (945-218-91-52 / 9452189152)
 * and normalize to 10 digits without separators. Returns null if not 10 digits.
 */
export function normalizeReceiptOcrNip(value: string | null | undefined): string | null {
  const digits = normalizeNipDigits(value ?? '')
  return digits && digits.length === 10 ? digits : null
}

export function isKnownFleetIssuerNip(value: string | null | undefined): boolean {
  const digits = normalizeReceiptOcrNip(value)
  return Boolean(digits && KNOWN_FLEET_ISSUER_NIP_DIGITS.has(digits))
}

/**
 * True when a string is (only) a Polish NIP shape — never a fiscal receipt document number.
 * Does not require checksum validity: printed issuer NIPs (and OCR noise) may fail isValidNip
 * while still being clearly a NIP (e.g. 945-218-91-52), not W001776.
 */
export function looksLikeNipAsDocumentNumber(value: string | null | undefined): boolean {
  if (value == null) return false
  const trimmed = value.trim()
  if (!trimmed) return false
  // Only digits and typical NIP separators — anything with letters is a document serial
  if (!/^[\d\s\-./]+$/.test(trimmed)) return false
  const digits = normalizeReceiptOcrNip(trimmed)
  if (!digits) return false
  const compact = trimmed.replace(/[\s\-./]/g, '')
  return compact === digits
}

/**
 * Prefer fiscal receipt numbers like W001776 from excerpt; never return a NIP.
 */
export function extractFiscalDocumentNumberFromExcerpt(excerpt: string | null | undefined): string | null {
  if (!excerpt?.trim()) return null
  const text = excerpt.replace(/\r/g, '\n')

  const labeled = text.match(
    /(?:nr\.?\s*(?:paragonu|dokumentu|dok\.?)|paragon(?:\s+fiskalny)?|dokument)\s*[:#]?\s*([A-Z]\d{3,}|\d{3,}[A-Z]?\d*)/i,
  )
  if (labeled?.[1] && !looksLikeNipAsDocumentNumber(labeled[1])) {
    return labeled[1].trim().toUpperCase()
  }

  // Common taxi fiscal print: letter + serial (e.g. W001776) — skip bare NIP lines
  const serials = text.match(/\b([A-Z]\d{4,8})\b/gi) ?? []
  for (const serial of serials) {
    if (!looksLikeNipAsDocumentNumber(serial)) return serial.toUpperCase()
  }

  return null
}

/**
 * Recover buyer NIP from excerpt when the model skipped "NIP nabywcy" near the footer.
 * Accepts dashed (701-053-39-02) and compact (7010533902) forms.
 */
export function extractBuyerNipFromExcerpt(excerpt: string | null | undefined): string | null {
  if (!excerpt?.trim()) return null
  const text = excerpt.replace(/\r/g, '\n')
  const match = text.match(
    /NIP\s*nabyw\w*\s*[:#]?\s*([0-9][\d\-./ ]{8,14}[0-9])/i,
  )
  if (!match?.[1]) return null
  const digits = normalizeReceiptOcrNip(match[1])
  if (!digits || isKnownFleetIssuerNip(digits)) return null
  return digits
}

/**
 * Recover seller/issuer NIP from header "NIP:" line (not "NIP nabywcy").
 * Accepts dashed and compact forms; normalizes to digits only.
 */
export function extractSellerNipFromExcerpt(excerpt: string | null | undefined): string | null {
  if (!excerpt?.trim()) return null
  const text = excerpt.replace(/\r/g, '\n')
  const lines = text.split(/\n+/)
  for (const line of lines) {
    if (/nabyw/i.test(line)) continue
    const match = line.match(/\bNIP\s*[:#]?\s*([0-9][\d\-./ ]{8,14}[0-9])/i)
    if (!match?.[1]) continue
    const digits = normalizeReceiptOcrNip(match[1])
    if (digits) return digits
  }
  return null
}

/**
 * Fix common OCR mix-up: seller NIP (header) misread as documentNumber.
 * Normalize all NIPs to 10 digits without separators.
 */
export function sanitizeReceiptOcrFields(fields: ReceiptOcrFields): ReceiptOcrFields {
  let documentNumber = fields.documentNumber?.trim() || null
  let sellerNip = normalizeReceiptOcrNip(fields.sellerNip)
  let buyerNip = normalizeReceiptOcrNip(fields.buyerNip)

  if (documentNumber && looksLikeNipAsDocumentNumber(documentNumber)) {
    const digits = normalizeReceiptOcrNip(documentNumber)
    if (digits) {
      if (!sellerNip || isKnownFleetIssuerNip(digits)) {
        sellerNip = digits
      }
    }
    documentNumber = null
  }

  if (!sellerNip) {
    sellerNip = extractSellerNipFromExcerpt(fields.rawExcerpt)
  }

  if (sellerNip && isKnownFleetIssuerNip(sellerNip)) {
    sellerNip = RS_MOTO_ISSUER_NIP_DIGITS
  }

  // Never keep buyerNip as our issuer NIP (that NIP is always the seller on our receipts)
  if (buyerNip && isKnownFleetIssuerNip(buyerNip)) {
    if (!sellerNip) sellerNip = RS_MOTO_ISSUER_NIP_DIGITS
    buyerNip = null
  }

  if (!buyerNip) {
    buyerNip = extractBuyerNipFromExcerpt(fields.rawExcerpt)
  }

  if (!documentNumber) {
    documentNumber = extractFiscalDocumentNumberFromExcerpt(fields.rawExcerpt)
  }

  return {
    ...fields,
    documentNumber,
    sellerNip,
    buyerNip,
  }
}
