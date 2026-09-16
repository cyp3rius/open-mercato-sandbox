import { normalizeNipDigits } from '@open-mercato/core/modules/customers/lib/nip'
import type { ReceiptOcrFields } from './receiptOcrExtract'
import { resolveReceiptDocumentKind, excerptLooksLikeFiscalReceipt } from './receiptDocumentKind'

/** RS Investment Group — fleet company NIP (seller on taxi receipts; buyer on expense slips). */
export const RS_MOTO_ISSUER_NIP_DIGITS = '9452189152'

/** Common OCR misreads of the fleet NIP (checksum / last digits). */
const KNOWN_FLEET_ISSUER_NIP_DIGITS = new Set([
  RS_MOTO_ISSUER_NIP_DIGITS,
  '9452189182',
  '9452189102',
  '9452189150',
  '9452189158',
])

/** Same 8-digit stem as RS Investment Group — OCR often flips the last 1–2 digits. */
const FLEET_NIP_STEM = '94521891'

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
  if (!digits) return false
  if (KNOWN_FLEET_ISSUER_NIP_DIGITS.has(digits)) return true
  // Soft match: printed fleet NIP with OCR noise on the checksum / tail.
  return digits.startsWith(FLEET_NIP_STEM)
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
 * Prefer fiscal receipt numbers like W001776 from excerpt; never return a NIP
 * or a taxi "Nr boczny" (side number) value such as 0000.
 */
export function extractFiscalDocumentNumberFromExcerpt(excerpt: string | null | undefined): string | null {
  if (!excerpt?.trim()) return null
  const text = excerpt
    .replace(/\r/g, '\n')
    // Side / fleet numbers and PolCard terminal lines are never the fiscal receipt id.
    .split(/\n+/)
    .filter((line) => !/nr\.?\s*boczny/i.test(line))
    .filter(
      (line) =>
        !/\bpolcard\b|\bfiserv\b|kod\s+autoryzac|contactless|\bmid\s*:|\bpos\s*id\s*:|rachunek\s+nr/i.test(
          line,
        ),
    )
    .join('\n')

  const labeled = text.match(
    /(?:nr\.?\s*(?:paragonu|dokumentu|dok\.?)|paragon(?:\s+fiskalny)?|dokument)\s*[:#]?\s*([A-Z]\d{3,}|\d{3,}[A-Z]?\d*)/i,
  )
  if (
    labeled?.[1] &&
    !looksLikeNipAsDocumentNumber(labeled[1]) &&
    !looksLikeSideNumberAsDocumentNumber(labeled[1]) &&
    !looksLikePolcardAuthAsDocumentNumber(labeled[1])
  ) {
    return labeled[1].trim().toUpperCase()
  }

  // Common taxi fiscal print: letter + serial (e.g. W001776 / W001530) — skip bare NIP lines
  const serials = text.match(/\b([A-Z]\d{4,8})\b/gi) ?? []
  for (const serial of serials) {
    if (looksLikeNipAsDocumentNumber(serial)) continue
    if (looksLikeSideNumberAsDocumentNumber(serial)) continue
    if (looksLikePolcardAuthAsDocumentNumber(serial)) continue
    return serial.toUpperCase()
  }

  return null
}

/**
 * Taxi printers show "Nr boczny: 0000" (vehicle side number). That is never the
 * fiscal document number — the W-serial sits on the next line (e.g. W001530).
 */
export function looksLikeSideNumberAsDocumentNumber(value: string | null | undefined): boolean {
  if (value == null) return false
  const trimmed = value.trim()
  if (!trimmed) return false
  // Pure zero pads and other short numeric side codes (no letters).
  if (/^0{1,8}$/.test(trimmed)) return true
  if (/^#?0{1,6}$/.test(trimmed)) return true
  return false
}

/**
 * PolCard auth / reference codes are short digit-only tokens (e.g. 694974).
 * Never treat them as the fiscal receipt number when a W-serial is available.
 */
export function looksLikePolcardAuthAsDocumentNumber(value: string | null | undefined): boolean {
  if (value == null) return false
  const trimmed = value.trim()
  if (!trimmed) return false
  return /^\d{4,8}$/.test(trimmed)
}

/** True when `documentNumber` appears only as the value of a "Nr boczny" label. */
export function isDocumentNumberTiedToBocznyLabel(
  excerpt: string | null | undefined,
  documentNumber: string | null | undefined,
): boolean {
  if (!excerpt?.trim() || !documentNumber?.trim()) return false
  const escaped = documentNumber.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`nr\\.?\\s*boczny\\s*[:#]?\\s*${escaped}\\b`, 'i').test(excerpt)
}

/**
 * Recover buyer NIP from excerpt.
 *
 * Trip receipts: only accept an explicit "NIP nabywcy" label (footer). Individual
 * trips often have no buyer NIP — never fall back to the header seller "NIP:" line.
 * Expense slips may also recover from a labeled nabywcy / buyer block.
 */
export function extractBuyerNipFromExcerpt(
  excerpt: string | null | undefined,
  options?: { allowFleetNip?: boolean; labeledOnly?: boolean },
): string | null {
  if (!excerpt?.trim()) return null
  const text = excerpt.replace(/\r/g, '\n')
  const labeledOnly = options?.labeledOnly === true
  const match = text.match(
    /NIP\s*nabyw\w*\s*[:#]?\s*(?:PL)?([0-9][\d\-./ ]{8,14}[0-9])/i,
  )
  if (match?.[1]) {
    const digits = canonicalizeFleetNip(match[1]) ?? normalizeReceiptOcrNip(match[1])
    if (!digits) return null
    if (isKnownFleetIssuerNip(digits) && !options?.allowFleetNip) return null
    if (isBdoNumberInExcerpt(digits, excerpt)) return null
    return digits
  }
  if (labeledOnly) return null

  // Expense fallback only: scan remaining lines, still skip BDO / unlabeled header noise when possible.
  const lines = text.split(/\n+/)
  const footerStart = Math.max(0, Math.floor(lines.length * 0.45))
  for (let index = footerStart; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    if (lineLooksLikeBdo(line) || /nabyw/i.test(line)) continue
    if (!/(?:nabyw|kupuj|nazwa\s+firmy|dane\s+nabyw)/i.test(line) && !/\bNIP\b/i.test(line)) {
      continue
    }
    const other = line.match(/\bNIP\s*[:#]?\s*(?:PL)?([0-9][\d\-./ ]{8,14}[0-9])/i)
    if (!other?.[1]) continue
    const digits = canonicalizeFleetNip(other[1]) ?? normalizeReceiptOcrNip(other[1])
    if (!digits) continue
    if (isKnownFleetIssuerNip(digits) && !options?.allowFleetNip) continue
    if (isBdoNumberInExcerpt(digits, excerpt)) continue
    return digits
  }
  return null
}

/**
 * Recover seller/issuer NIP from the HEADER "NIP:" line (top of receipt).
 * Skips "NIP nabywcy" and BDO. Prefers lines above the fiscal body.
 */
export function extractSellerNipFromExcerpt(excerpt: string | null | undefined): string | null {
  if (!excerpt?.trim()) return null
  const text = excerpt.replace(/\r/g, '\n')
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean)
  if (!lines.length) return null

  const bodyMarkerIndex = lines.findIndex((line) =>
    /paragon\s+fiskalny|pocz[aą]tek\s+kursu|do\s+zapłaty|rozliczenie\s+płat/i.test(line),
  )
  const headerLimit =
    bodyMarkerIndex > 0 ? bodyMarkerIndex : Math.max(3, Math.ceil(lines.length / 3))
  const headerLines = lines.slice(0, headerLimit)
  const searchOrder = [...headerLines, ...lines.slice(headerLimit)]

  for (const line of searchOrder) {
    if (/nabyw/i.test(line)) continue
    if (lineLooksLikeBdo(line)) continue
    const match = line.match(/\bNIP\s*[:#]?\s*(?:PL)?([0-9][\d\-./ ]{8,14}[0-9])/i)
    if (!match?.[1]) continue
    const digits = normalizeReceiptOcrNip(match[1])
    if (!digits) continue
    if (isBdoNumberInExcerpt(digits, excerpt)) continue
    return digits
  }
  return null
}

/** True when the line is a BDO (waste registry) label — never a NIP source. */
export function lineLooksLikeBdo(line: string): boolean {
  return /\bBDO\b/i.test(line)
}

/**
 * Collect digit-normalized BDO registry numbers from excerpt labels.
 * BDO is not a tax ID; OCR often misreads it as sellerNip.
 */
export function extractBdoNumbersFromExcerpt(excerpt: string | null | undefined): string[] {
  if (!excerpt?.trim()) return []
  const text = excerpt.replace(/\r/g, '\n')
  const found: string[] = []
  const labeled = text.matchAll(
    /\bBDO\b\s*[:#]?\s*(?:nr\.?\s*)?([0-9][\d\-./ ]{6,18}[0-9])/gi,
  )
  for (const match of labeled) {
    const digits = normalizeNipDigits(match[1] ?? '')
    if (digits && digits.length >= 7) found.push(digits)
  }
  return found
}

export function isBdoNumberInExcerpt(
  value: string | null | undefined,
  excerpt: string | null | undefined,
): boolean {
  const digits = normalizeNipDigits(value ?? '')
  if (!digits) return false
  return extractBdoNumbersFromExcerpt(excerpt).some(
    (bdo) => bdo === digits || bdo.endsWith(digits) || digits.endsWith(bdo),
  )
}

export function excerptLooksLikeWzSlip(excerpt: string | null | undefined): boolean {
  if (!excerpt?.trim()) return false
  return /\bkwit\s*wz\b|\bwz\s*[:/]|\bdokument\s+wz\b/i.test(excerpt)
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

  const documentKind = resolveReceiptDocumentKind({
    documentKind: fields.documentKind ?? null,
    rawExcerpt: fields.rawExcerpt,
  })
  const isWzExpense =
    mode === 'expense' && (documentKind === 'wz_slip' || excerptLooksLikeWzSlip(fields.rawExcerpt))

  // BDO registry numbers look numeric; never treat them as tax IDs.
  if (sellerNip && isBdoNumberInExcerpt(sellerNip, fields.rawExcerpt)) {
    sellerNip = null
  }
  if (buyerNip && isBdoNumberInExcerpt(buyerNip, fields.rawExcerpt)) {
    buyerNip = null
  }

  // KWIT WZ has no issuer NIP — drop model/BDO guesses entirely.
  if (isWzExpense) {
    sellerNip = null
  }

  if (documentNumber && looksLikeNipAsDocumentNumber(documentNumber)) {
    const digits = normalizeReceiptOcrNip(documentNumber)
    if (digits && !isBdoNumberInExcerpt(digits, fields.rawExcerpt)) {
      if (mode === 'expense') {
        if (isKnownFleetIssuerNip(digits)) {
          buyerNip = buyerNip ?? canonicalizeFleetNip(digits)
        } else if (!sellerNip && !isWzExpense) {
          sellerNip = digits
        }
      } else if (!sellerNip || isKnownFleetIssuerNip(digits)) {
        sellerNip = digits
      }
    }
    documentNumber = null
  }

  // "Nr boczny: 0000" is the vehicle side number — never the fiscal receipt id.
  if (
    documentNumber &&
    (looksLikeSideNumberAsDocumentNumber(documentNumber) ||
      isDocumentNumberTiedToBocznyLabel(fields.rawExcerpt, documentNumber))
  ) {
    documentNumber = null
  }

  // PolCard auth codes in dual photos must not replace the fiscal W-serial.
  if (
    documentNumber &&
    looksLikePolcardAuthAsDocumentNumber(documentNumber) &&
    excerptLooksLikeFiscalReceipt(fields.rawExcerpt)
  ) {
    documentNumber = null
  }

  if (!sellerNip && !isWzExpense) {
    sellerNip = extractSellerNipFromExcerpt(fields.rawExcerpt)
  }

  if (mode === 'expense') {
    if (sellerNip && isKnownFleetIssuerNip(sellerNip)) {
      buyerNip = buyerNip ?? canonicalizeFleetNip(sellerNip)
      sellerNip = null
      if (!isWzExpense) {
        sellerNip = extractSellerNipFromExcerpt(fields.rawExcerpt)
        if (sellerNip && isKnownFleetIssuerNip(sellerNip)) sellerNip = null
      }
    }
    if (sellerNip && isBdoNumberInExcerpt(sellerNip, fields.rawExcerpt)) {
      sellerNip = null
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
    // Never keep buyerNip as our issuer NIP (header seller NIP on taxi receipts).
    if (buyerNip && isKnownFleetIssuerNip(buyerNip)) {
      if (!sellerNip) sellerNip = RS_MOTO_ISSUER_NIP_DIGITS
      buyerNip = null
    }
    // Trip receipts: buyer only from an explicit "NIP nabywcy" footer label.
    const labeledBuyer = extractBuyerNipFromExcerpt(fields.rawExcerpt, { labeledOnly: true })
    if (labeledBuyer) {
      buyerNip = labeledBuyer
    } else if (
      !buyerNip ||
      (sellerNip != null && buyerNip === sellerNip) ||
      !/NIP\s*nabyw/i.test(fields.rawExcerpt ?? '')
    ) {
      // Individual trips have blank orderer fields — do not invent buyer from header NIP.
      buyerNip = null
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
