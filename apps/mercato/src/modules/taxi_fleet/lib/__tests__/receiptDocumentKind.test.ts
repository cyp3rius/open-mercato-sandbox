import {
  isPolcardPaymentConfirmation,
  resolveReceiptDocumentKind,
} from '../receiptDocumentKind'

describe('isPolcardPaymentConfirmation', () => {
  it('detects explicit documentKind', () => {
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
})

describe('resolveReceiptDocumentKind', () => {
  it('normalizes Polcard detections', () => {
    expect(
      resolveReceiptDocumentKind({
        documentKind: 'unknown',
        rawExcerpt: 'POLCARD potwierdzenie',
      }),
    ).toBe('polcard_payment_confirmation')
  })
})
