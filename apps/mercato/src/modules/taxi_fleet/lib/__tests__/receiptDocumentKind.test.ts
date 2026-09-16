import {
  excerptLooksLikeFiscalReceipt,
  isPolcardPaymentConfirmation,
  resolveReceiptDocumentKind,
} from '../receiptDocumentKind'
import { sanitizeReceiptOcrFields } from '../receiptOcrSanitize'

const MIXED_PARAGON_AND_POLCARD = [
  'RS INVESTMENT GROUP',
  'NIP: 945-218-91-82',
  'Nr rejestr.: KK3666G, Nr boczny: 0000',
  'W001900',
  'PARAGON FISKALNY',
  'Początek kursu : 16-09-2026 09:12',
  'Koniec kursu : 16-09-2026 09:48',
  'Odległość przejechana : 28.5km',
  'SUMA: PLN 150.00',
  'DO ZAPŁATY: 150.00',
  'Karta: 150.00',
  'PolCard from fiserv',
  'MID: 72339097',
  'POS ID: 27334995',
  'KOD AUTORYZACJI: (1) 694974',
  'CONTACTLESS',
].join('\n')

describe('isPolcardPaymentConfirmation', () => {
  it('detects explicit documentKind when no fiscal markers', () => {
    expect(
      isPolcardPaymentConfirmation({
        documentKind: 'polcard_payment_confirmation',
        rawExcerpt: null,
      }),
    ).toBe(true)
  })

  it('detects POLCARD brand in excerpt', () => {
    expect(
      isPolcardPaymentConfirmation({
        documentKind: 'unknown',
        rawExcerpt: 'POLCARD\nKwota: 85,00 PLN\nTerminal 1234',
      }),
    ).toBe(true)
  })

  it('detects payment_confirmation kind', () => {
    expect(
      isPolcardPaymentConfirmation({
        documentKind: 'payment_confirmation',
        rawExcerpt: 'Potwierdzenie płatności',
      }),
    ).toBe(true)
  })

  it('detects payment slip wording with card cues', () => {
    expect(
      isPolcardPaymentConfirmation({
        documentKind: 'unknown',
        rawExcerpt: 'Potwierdzenie płatności\nKarta Visa ****1234\nAutoryzacja: 998877',
      }),
    ).toBe(true)
  })

  it('does not flag fiscal receipts', () => {
    expect(
      isPolcardPaymentConfirmation({
        documentKind: 'fiscal_receipt',
        rawExcerpt: 'Paragon fiskalny\nNIP: 9452189152\nNIP nabywcy: 7010533902\nW001776',
      }),
    ).toBe(false)
  })

  it('does not flag dual photos that include both PolCard and PARAGON FISKALNY', () => {
    expect(
      isPolcardPaymentConfirmation({
        documentKind: 'polcard_payment_confirmation',
        rawExcerpt: MIXED_PARAGON_AND_POLCARD,
      }),
    ).toBe(false)
    expect(excerptLooksLikeFiscalReceipt(MIXED_PARAGON_AND_POLCARD)).toBe(true)
  })
})

describe('resolveReceiptDocumentKind', () => {
  it('normalizes Polcard detections', () => {
    expect(
      resolveReceiptDocumentKind({
        documentKind: 'unknown',
        rawExcerpt: 'POLCARD potwierdzenie MID: 1',
      }),
    ).toBe('polcard_payment_confirmation')
  })

  it('prefers fiscal_receipt when PolCard and paragon share one excerpt', () => {
    expect(
      resolveReceiptDocumentKind({
        documentKind: 'polcard_payment_confirmation',
        rawExcerpt: MIXED_PARAGON_AND_POLCARD,
      }),
    ).toBe('fiscal_receipt')
  })
})

describe('sanitizeReceiptOcrFields with mixed PolCard + paragon', () => {
  it('keeps fiscal fields and replaces PolCard auth with W-serial', () => {
    const sanitized = sanitizeReceiptOcrFields(
      {
        documentKind: 'polcard_payment_confirmation',
        documentNumber: '694974',
        grossAmount: 150,
        distanceKm: 28.5,
        vatRatePercent: 8,
        vatAmount: 11.11,
        sellerNip: '945-218-91-82',
        registrationPlate: 'KK3666G',
        rawExcerpt: MIXED_PARAGON_AND_POLCARD,
      },
      { mode: 'trip' },
    )
    expect(sanitized.documentKind).toBe('fiscal_receipt')
    expect(sanitized.documentNumber).toBe('W001900')
    expect(sanitized.grossAmount).toBe(150)
    expect(sanitized.distanceKm).toBe(28.5)
    expect(sanitized.sellerNip).toBe('9452189152')
    expect(isPolcardPaymentConfirmation(sanitized)).toBe(false)
  })
})
