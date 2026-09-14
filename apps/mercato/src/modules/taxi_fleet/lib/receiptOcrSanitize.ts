import { normalizeNipDigits } from '@open-mercato/core/modules/customers/lib/nip'
import type { ReceiptOcrFields } from './receiptOcrExtract'
import { resolveReceiptDocumentKind } from './receiptDocumentKind'

/** RS Investment Group — fleet company NIP (seller on taxi receipts; buyer on expense slips). */
export const RS_MOTO_ISSUER_NIP_DIGITS = '9452189152'

/** Common OCR misreads of the fleet NIP (checksum digit). */
const KNOWN_FLEET_ISSUER_NIP_DIGITS = new Set([
  RS_MOTO_ISSUER_NIP_DIGITS,
  '9452189182',
])

export type ReceiptOcrSanitizeMode = 'trip' | 'expense'

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

export function canonicalizeFleetNip(value: string | null | undefined): string | null {
  if (!isKnownFleetIssuerNip(value)) return normalizeReceiptOcrNip(value)
  return RS_MOTO_ISSUER_NIP_DIGITS
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
export function extractBuyerNipFromExcerpt(
  excerpt: string | null | undefined,
  options?: { allowFleetNip?: boolean },
): string | null {
  if (!excerpt?.trim()) return null
  const text = excerpt.replace(/\r/g, '\n')
  const match = text.match(
    /NIP\s*nabyw\w*\s*[:#]?\s*(?:PL)?([0-9][\d\-./ ]{8,14}[0-9])/i,
  )
  if (!match?.[1]) {
    const other = text.match(
      /(?:NIP|Inne informacje)\s*[:#]?\s*(?:PL)?([0-9][\d\-./ ]{8,14}[0-9])/i,
    )
    if (!other?.[1]) return null
    const digits = canonicalizeFleetNip(other[1]) ?? normalizeReceiptOcrNip(other[1])
    if (!digits) return null
    if (isKnownFleetIssuerNip(digits) && !options?.allowFleetNip) return null
    return digits
  }
  const digits = canonicalizeFleetNip(match[1]) ?? normalizeReceiptOcrNip(match[1])
  if (!digits) return null
  if (isKnownFleetIssuerNip(digits) && !options?.allowFleetNip) return null
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
    const match = line.match(/\bNIP\s*[:#]?\s*(?:PL)?([0-9][\d\-./ ]{8,14}[0-9])/i)
    if (!match?.[1]) continue
    const digits = normalizeReceiptOcrNip(match[1])
    if (digits) return digits
  }
  return null
}

/**
 * Recover vehicle registration plate (e.g. Rejestracja: KK3666G).
 */
export function extractRegistrationPlateFromExcerpt(excerpt: string | null | undefined): string | null {
  if (!excerpt?.trim()) return null
  const text = excerpt.replace(/\r/g, '\n')
  const labeled = text.match(
    /(?:rejestracj\w*|nr\.?\s*rej\.?|tablica)\s*[:#]?\s*([A-Z]{2,3}\s?[A-Z0-9]{4,7})/i,
  )
  if (labeled?.[1]) {
    return labeled[1].replace(/\s+/g, '').toUpperCase()
  }
  return null
}

/**
 * When VAT % is missing, derive rate from gross + VAT amount and snap to 8/23.
 */
export function deriveVatRatePercentFromAmount(params: {
  grossAmount: number | null | undefined
  vatAmount: number | null | undefined
  vatRatePercent: number | null | undefined
}): number | null {
  if (params.vatRatePercent != null && Number.isFinite(params.vatRatePercent)) {
    return params.vatRatePercent
  }
  const gross = params.grossAmount
  const vat = params.vatAmount
  if (gross == null || vat == null || !Number.isFinite(gross) || !Number.isFinite(vat)) return null
  if (gross <= 0 || vat < 0 || vat >= gross) return null
  const net = gross - vat
  if (net <= 0) return null
  const raw = (vat / net) * 100
  // Snap to allowed expense rates (8 or 23).
  return Math.abs(raw - 8) <= Math.abs(raw - 23) ? 8 : 23
}

/**
 * Fix common OCR mix-up: seller NIP (header) misread as documentNumber.
 * Normalize all NIPs to 10 digits without separators.
 *
 * `mode: 'trip'` — fleet NIP is seller on RS Moto fiscal receipts.
 * `mode: 'expense'` — fleet NIP is buyer on fuel/WZ slips; never promote to seller.
 */
export function sanitizeReceiptOcrFields(
  fields: ReceiptOcrFields,
  options?: { mode?: ReceiptOcrSanitizeMode },
): ReceiptOcrFields {
  const mode = options?.mode ?? 'trip'
  let documentNumber = fields.documentNumber?.trim() || null
  let sellerNip = normalizeReceiptOcrNip(fields.sellerNip)
  let buyerNip = normalizeReceiptOcrNip(fields.buyerNip)
  let registrationPlate =
    typeof fields.registrationPlate === 'string' ? fields.registrationPlate.trim() || null : null

  if (documentNumber && looksLikeNipAsDocumentNumber(documentNumber)) {
    const digits = normalizeReceiptOcrNip(documentNumber)
    if (digits) {
      if (mode === 'expense') {
        if (isKnownFleetIssuerNip(digits)) {
          buyerNip = buyerNip ?? canonicalizeFleetNip(digits)
        } else if (!sellerNip) {
          sellerNip = digits
        }
      } else if (!sellerNip || isKnownFleetIssuerNip(digits)) {
        sellerNip = digits
      }
    }
    documentNumber = null
  }

  if (!sellerNip) {
    sellerNip = extractSellerNipFromExcerpt(fields.rawExcerpt)
  }

  if (mode === 'expense') {
    if (sellerNip && isKnownFleetIssuerNip(sellerNip)) {
      buyerNip = buyerNip ?? canonicalizeFleetNip(sellerNip)
      sellerNip = null
      sellerNip = extractSellerNipFromExcerpt(fields.rawExcerpt)
      if (sellerNip && isKnownFleetIssuerNip(sellerNip)) sellerNip = null
    }
    if (buyerNip && isKnownFleetIssuerNip(buyerNip)) {
      buyerNip = RS_MOTO_ISSUER_NIP_DIGITS
    }
    if (!buyerNip) {
      buyerNip = extractBuyerNipFromExcerpt(fields.rawExcerpt, { allowFleetNip: true })
    }
  } else {
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
  }

  if (!documentNumber) {
    documentNumber = extractFiscalDocumentNumberFromExcerpt(fields.rawExcerpt)
  }

  if (!registrationPlate) {
    registrationPlate = extractRegistrationPlateFromExcerpt(fields.rawExcerpt)
  }

  const derivedVat = deriveVatRatePercentFromAmount({
    grossAmount: fields.grossAmount ?? null,
    vatAmount: fields.vatAmount ?? null,
    vatRatePercent: fields.vatRatePercent ?? null,
  })

  const documentKind = resolveReceiptDocumentKind({
    documentKind: fields.documentKind ?? null,
    rawExcerpt: fields.rawExcerpt,
  })

  return {
    ...fields,
    documentNumber,
    sellerNip,
    buyerNip,
    registrationPlate,
    vatRatePercent: derivedVat,
    documentKind,
  }
}
