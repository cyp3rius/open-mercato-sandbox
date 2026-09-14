import {
  filterAndSumBpTransactionsByCard,
  normalizeBpCardNumber,
  normalizeBpTransaction,
} from '../bpOpenFleet/client'

describe('bpOpenFleet normalization', () => {
  it('normalizes card numbers by stripping spaces and dashes', () => {
    expect(normalizeBpCardNumber('1234 5678-9012')).toBe('123456789012')
  })

  it('reads gross invoice amount and card from BP payload', () => {
    const tx = normalizeBpTransaction({
      transactionUniqueId: 'tx-1',
      fullCardNumber: '7001 0011 22',
      grossInvoiceValueInInvoiceCurrency: 123.45,
      quantity: 40.2,
      productDescription: 'Diesel',
      siteName: 'BP Test',
      transactionDateTime: '2026-08-15T10:00:00Z',
    })
    expect(tx).toEqual({
      transactionId: 'tx-1',
      cardNumber: '7001001122',
      grossAmount: 123.45,
      quantity: 40.2,
      productDescription: 'Diesel',
      siteName: 'BP Test',
      transactionDateTime: '2026-08-15T10:00:00Z',
      vehicleRegistrationNumber: null,
    })
  })

  it('sums only matching cards as gross total', () => {
    const { matched, grossTotal } = filterAndSumBpTransactionsByCard(
      [
        {
          transactionId: '1',
          cardNumber: 'AAA',
          grossAmount: 10,
          quantity: 1,
          productDescription: null,
          siteName: null,
          transactionDateTime: null,
          vehicleRegistrationNumber: null,
        },
        {
          transactionId: '2',
          cardNumber: 'BBB',
          grossAmount: 20,
          quantity: 1,
          productDescription: null,
          siteName: null,
          transactionDateTime: null,
          vehicleRegistrationNumber: null,
        },
        {
          transactionId: '3',
          cardNumber: 'AAA',
          grossAmount: 5.5,
          quantity: 1,
          productDescription: null,
          siteName: null,
          transactionDateTime: null,
          vehicleRegistrationNumber: null,
        },
      ],
      'aa a',
    )
    expect(matched.map((row) => row.transactionId)).toEqual(['1', '3'])
    expect(grossTotal).toBe(15.5)
  })
})
