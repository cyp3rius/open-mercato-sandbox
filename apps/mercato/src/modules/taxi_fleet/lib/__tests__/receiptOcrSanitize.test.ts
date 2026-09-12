import {
  extractBuyerNipFromExcerpt,
  extractFiscalDocumentNumberFromExcerpt,
  extractSellerNipFromExcerpt,
  looksLikeNipAsDocumentNumber,
  normalizeReceiptOcrNip,
  RS_MOTO_ISSUER_NIP_DIGITS,
  sanitizeReceiptOcrFields,
} from '../receiptOcrSanitize'
import { mergeReceiptDocumentNumber } from '../receiptExtractionRules'

describe('normalizeReceiptOcrNip', () => {
  it('accepts dashed and compact forms and strips separators', () => {
    expect(normalizeReceiptOcrNip('945-218-91-52')).toBe('9452189152')
    expect(normalizeReceiptOcrNip('9452189152')).toBe('9452189152')
    expect(normalizeReceiptOcrNip('701-053-39-02')).toBe('7010533902')
    expect(normalizeReceiptOcrNip('7010533902')).toBe('7010533902')
    expect(normalizeReceiptOcrNip('945 218 91 52')).toBe('9452189152')
    expect(normalizeReceiptOcrNip('123')).toBeNull()
    expect(normalizeReceiptOcrNip(null)).toBeNull()
  })
})

describe('receiptOcrSanitize', () => {
  it('detects NIP mistaken as document number', () => {
    expect(looksLikeNipAsDocumentNumber('945-218-91-52')).toBe(true)
    expect(looksLikeNipAsDocumentNumber('9452189152')).toBe(true)
    expect(looksLikeNipAsDocumentNumber('W001776')).toBe(false)
    expect(looksLikeNipAsDocumentNumber('FV/12/2026')).toBe(false)
  })

  it('moves issuer NIP from documentNumber to sellerNip and recovers W-serial from excerpt', () => {
    const sanitized = sanitizeReceiptOcrFields({
      documentNumber: '945-218-91-52',
      sellerNip: '9452189152',
      grossAmount: 150,
      rawExcerpt:
        'PARAGON FISKALNY\nNIP: 945-218-91-52\nW001776\nPoczatek kursu: 10-09-2026 08:33\nSUMA: PLN 150.00',
      confidence: 0.75,
    })
    expect(sanitized.documentNumber).toBe('W001776')
    expect(sanitized.sellerNip).toBe(RS_MOTO_ISSUER_NIP_DIGITS)
  })

  it('normalizes dashed seller NIP from model to digits-only', () => {
    const sanitized = sanitizeReceiptOcrFields({
      sellerNip: '945-218-91-52',
      rawExcerpt: null,
    })
    expect(sanitized.sellerNip).toBe('9452189152')
  })

  it('extracts seller NIP from header excerpt when model omitted it', () => {
    expect(extractSellerNipFromExcerpt('NIP: 945-218-91-52\nPARAGON FISKALNY')).toBe('9452189152')
    expect(extractSellerNipFromExcerpt('NIP: 9452189152\nPARAGON FISKALNY')).toBe('9452189152')
    const sanitized = sanitizeReceiptOcrFields({
      sellerNip: null,
      rawExcerpt: 'RS INVESTMENT\nNIP: 945-218-91-52\nW001776',
    })
    expect(sanitized.sellerNip).toBe(RS_MOTO_ISSUER_NIP_DIGITS)
  })

  it('extracts W-serial from excerpt without NIP confusion', () => {
    expect(
      extractFiscalDocumentNumberFromExcerpt(
        'NIP: 945-218-91-52\nPARAGON FISKALNY\nW001776\nDO ZAPŁATY 150.00',
      ),
    ).toBe('W001776')
  })

  it('recovers buyer NIP from NIP nabywcy line in excerpt', () => {
    expect(
      extractBuyerNipFromExcerpt(
        'Karta: 386.75\nNIP nabywcy: 701-053-39-02\n10-09-2026 16:16',
      ),
    ).toBe('7010533902')
    expect(extractBuyerNipFromExcerpt('NIP nabywcy: 7010533902')).toBe('7010533902')

    const sanitized = sanitizeReceiptOcrFields({
      documentNumber: 'W001900',
      sellerNip: '9452189152',
      buyerNip: null,
      grossAmount: 386.75,
      rawExcerpt:
        'NIP: 945-218-91-52\nDO ZAPŁATY 386.75\nKarta: 386.75\nNIP nabywcy: 701-053-39-02',
      confidence: 0.8,
    })
    expect(sanitized.buyerNip).toBe('7010533902')
    expect(sanitized.sellerNip).toBe(RS_MOTO_ISSUER_NIP_DIGITS)
  })

  it('does not treat issuer NIP as buyer NIP', () => {
    const sanitized = sanitizeReceiptOcrFields({
      buyerNip: '945-218-91-52',
      sellerNip: null,
      rawExcerpt: 'NIP: 945-218-91-52\nNIP nabywcy: 945-218-91-52',
    })
    expect(sanitized.buyerNip).toBeNull()
    expect(sanitized.sellerNip).toBe(RS_MOTO_ISSUER_NIP_DIGITS)
  })
})

describe('mergeReceiptDocumentNumber with NIP false-positive OCR', () => {
  it('does not conflict when OCR document number is issuer NIP and driver has real number', () => {
    const result = mergeReceiptDocumentNumber({
      driverDocumentNumber: 'W001776',
      ocrDocumentNumber: '945-218-91-52',
    })
    expect(result.documentNumber).toBe('W001776')
    expect(result.documentNumberSource).toBe('driver')
    expect(result.needsReview).toBe(false)
    expect(result.warnings).toEqual([])
  })
})
