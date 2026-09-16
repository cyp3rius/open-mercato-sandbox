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

  it('ignores Nr boczny 0000 and takes the W-serial below it', () => {
    const excerpt = [
      'RS INVESTMENT GROUP SP. Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
      'Jaworskiego 8/ 1, 31-519 Kraków',
      'NIP: 945-218-91-82',
      'Nr rejestr.: KK7300G,',
      'Nr boczny: 0000',
      'W001530',
      'PARAGON FISKALNY',
      'Początek kursu : 16-09-2026 03:51',
      'SUMA: PLN 121.20',
      'F940 #001 16.Administrator',
    ].join('\n')
    expect(extractFiscalDocumentNumberFromExcerpt(excerpt)).toBe('W001530')

    const sanitized = sanitizeReceiptOcrFields({
      documentNumber: '0000',
      sellerNip: null,
      grossAmount: 121.2,
      rawExcerpt: excerpt,
      confidence: 0.8,
    })
    expect(sanitized.documentNumber).toBe('W001530')
    expect(sanitized.sellerNip).toBe(RS_MOTO_ISSUER_NIP_DIGITS)
  })

  it('clears documentNumber when it is only the Nr boczny value', () => {
    const excerpt = 'Nr boczny: 12\nW001900\nPARAGON FISKALNY'
    const sanitized = sanitizeReceiptOcrFields({
      documentNumber: '12',
      rawExcerpt: excerpt,
    })
    expect(sanitized.documentNumber).toBe('W001900')
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

  it('trip mode: header seller NIP misread as buyer is cleared on individual receipts', () => {
    const sanitized = sanitizeReceiptOcrFields({
      buyerNip: '9452189102',
      sellerNip: null,
      documentNumber: 'W001530',
      grossAmount: 121.2,
      rawExcerpt: [
        'RS INVESTMENT GROUP SP. Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
        'Jaworskiego 8/ 1, 31-519 Kraków',
        'NIP: 945-218-91-82',
        'Nr rejestr.: KK7300G',
        'PARAGON FISKALNY',
        'Poczatek kursu: 16-09-2026 03:51',
        'Koniec kursu: 16-09-2026 04:07',
        'SUMA PLN 121.20',
        'Imię i nazwisko, adres zamawiającego :',
        'Kurs z :',
        'do :',
        'DO ZAPŁATY: 121.20',
      ].join('\n'),
    })
    expect(sanitized.buyerNip).toBeNull()
    expect(sanitized.sellerNip).toBe(RS_MOTO_ISSUER_NIP_DIGITS)
  })

  it('trip mode: does not invent buyer from unlabeled header NIP lines', () => {
    expect(
      extractBuyerNipFromExcerpt('NIP: 945-218-91-82\nPARAGON FISKALNY\nDO ZAPŁATY 121.20', {
        labeledOnly: true,
      }),
    ).toBeNull()
    expect(
      extractSellerNipFromExcerpt(
        [
          'RS INVESTMENT',
          'NIP: 945-218-91-82',
          'PARAGON FISKALNY',
          'DO ZAPŁATY 121.20',
          'NIP nabywcy: 701-053-39-02',
        ].join('\n'),
      ),
    ).toBe('9452189182')
  })

  it('expense mode keeps fleet NIP as buyer and never promotes to seller', () => {
    const sanitized = sanitizeReceiptOcrFields(
      {
        sellerNip: '9452189182',
        buyerNip: null,
        grossAmount: 200,
        vatAmount: 37.4,
        rawExcerpt:
          'BP\nNIP: 7740001454\nParagon fiskalny\nRejestracja: KK3666G\nNIP nabywcy: 945-218-91-82',
      },
      { mode: 'expense' },
    )
    expect(sanitized.sellerNip).toBe('7740001454')
    expect(sanitized.buyerNip).toBe(RS_MOTO_ISSUER_NIP_DIGITS)
    expect(sanitized.registrationPlate).toBe('KK3666G')
    expect(sanitized.vatRatePercent).toBe(23)
  })

  it('expense WZ does not treat BDO as seller NIP and leaves issuer empty', () => {
    const sanitized = sanitizeReceiptOcrFields(
      {
        documentKind: 'wz_slip',
        sellerNip: '0000579410',
        buyerNip: null,
        grossAmount: 200,
        rawExcerpt:
          'KWIT WZ\nBDO: 0000579410\nRejestracja: KK3666G\nNazwa firmy\nNIP: 945-218-91-82',
      },
      { mode: 'expense' },
    )
    expect(sanitized.documentKind).toBe('wz_slip')
    expect(sanitized.sellerNip).toBeNull()
    expect(sanitized.buyerNip).toBe(RS_MOTO_ISSUER_NIP_DIGITS)
    expect(sanitized.registrationPlate).toBe('KK3666G')
  })

  it('extractSellerNipFromExcerpt skips BDO lines', () => {
    expect(
      extractSellerNipFromExcerpt('BDO: 0000579410\nKWIT WZ\nNIP nabywcy: 9452189152'),
    ).toBeNull()
    expect(extractSellerNipFromExcerpt('NIP: 7740001454\nBDO: 0000579410')).toBe('7740001454')
  })

  it('derives VAT % from vatAmount when rate is missing', () => {
    const sanitized = sanitizeReceiptOcrFields(
      {
        grossAmount: 108,
        vatAmount: 8,
        vatRatePercent: null,
        rawExcerpt: null,
      },
      { mode: 'expense' },
    )
    expect(sanitized.vatRatePercent).toBe(8)
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
