import {
  mergeTripUpdateMetadata,
  readRequestId,
  resolvePaypalPaymentDisplayStatus,
  shouldShowPaypalPaymentPanel,
  TRIP_METADATA_PRESERVE_KEYS,
} from '../tripPaymentMetadata'

describe('mergeTripUpdateMetadata', () => {
  it('preserves inject/payment keys wiped by form metadata', () => {
    const existing = {
      requestId: 'RS-TX-2509181400-ABCD',
      paymentHash: '08142dd2-ac97-4128-94a7-0d0976d14812',
      paymentLink: 'https://paypal.example/approve',
      paypalOrderId: 'ORDER-1',
      source: 'rsmototaxi_calculator',
      locale: 'pl',
      tripRequest: { fromAddress: 'Old' },
    }
    const incoming = {
      tripRequest: { fromAddress: 'New', toAddress: 'Lotnisko' },
      serviceType: 'airport',
      quoteSnapshot: { totalPrice: 100 },
    }
    const merged = mergeTripUpdateMetadata(existing, incoming)
    expect(merged?.requestId).toBe('RS-TX-2509181400-ABCD')
    expect(merged?.paymentHash).toBe('08142dd2-ac97-4128-94a7-0d0976d14812')
    expect(merged?.paymentLink).toBe('https://paypal.example/approve')
    expect(merged?.paypalOrderId).toBe('ORDER-1')
    expect(merged?.source).toBe('rsmototaxi_calculator')
    expect(merged?.locale).toBe('pl')
    expect((merged?.tripRequest as { fromAddress: string }).fromAddress).toBe('New')
    expect(merged?.quoteSnapshot).toEqual({ totalPrice: 100 })
  })

  it('lets explicit incoming preserved keys win', () => {
    const merged = mergeTripUpdateMetadata(
      { requestId: 'OLD', paymentHash: 'hash-old' },
      { requestId: 'RS-TX-2509181400-NEWD', tripRequest: {} },
    )
    expect(merged?.requestId).toBe('RS-TX-2509181400-NEWD')
    expect(merged?.paymentHash).toBe('hash-old')
  })

  it('lists expected preserve keys', () => {
    expect(TRIP_METADATA_PRESERVE_KEYS).toContain('requestId')
    expect(TRIP_METADATA_PRESERVE_KEYS).toContain('paymentHash')
  })
})

describe('readRequestId', () => {
  it('prefers top-level requestId', () => {
    expect(
      readRequestId({
        id: '11111111-1111-4111-8111-111111111111',
        metadata: { requestId: 'RS-TX-2509181400-ABCD' },
      }),
    ).toBe('RS-TX-2509181400-ABCD')
  })

  it('falls back to strapi.requestId then trip id', () => {
    expect(
      readRequestId({
        id: '11111111-1111-4111-8111-111111111111',
        metadata: { strapi: { requestId: 'RS-TX-2509181400-STRP' } },
      }),
    ).toBe('RS-TX-2509181400-STRP')
    expect(
      readRequestId({
        id: '11111111-1111-4111-8111-111111111111',
        metadata: {},
      }),
    ).toBe('11111111-1111-4111-8111-111111111111')
  })
})

describe('shouldShowPaypalPaymentPanel', () => {
  it('shows for electronic form inject with payment hash', () => {
    expect(
      shouldShowPaypalPaymentPanel({
        status: 'new',
        metadata: {
          paymentType: 'electronic',
          paymentHash: 'hash-1',
          requestId: 'RS-TX-2509181400-ABCD',
        },
      }),
    ).toBe(true)
  })

  it('hides for cash payments', () => {
    expect(
      shouldShowPaypalPaymentPanel({
        status: 'new',
        metadata: { paymentType: 'cash', paymentHash: 'hash-1' },
      }),
    ).toBe(false)
  })
})

describe('resolvePaypalPaymentDisplayStatus', () => {
  it('maps enquiry and payment markers', () => {
    expect(
      resolvePaypalPaymentDisplayStatus({
        status: 'new',
        metadata: { enquiryStatus: 'new', paymentHash: 'h' },
      }),
    ).toBe('awaiting_approval')
    expect(
      resolvePaypalPaymentDisplayStatus({
        status: 'approved',
        metadata: { enquiryStatus: 'accepted', paymentLink: 'https://paypal.example' },
      }),
    ).toBe('awaiting_payment')
    expect(
      resolvePaypalPaymentDisplayStatus({
        status: 'paid',
        metadata: { enquiryStatus: 'paid', paidAt: '2026-09-18T12:00:00.000Z' },
      }),
    ).toBe('paid')
  })
})
