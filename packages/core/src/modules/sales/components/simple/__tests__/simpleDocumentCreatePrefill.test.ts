import {
  buildSimpleOrderCreateFromOfferHref,
  readLinkedOrderIdFromQuoteDoc,
  readSourceOfferIdFromSearchParams,
} from '../simpleDocumentCreatePrefill'

describe('simpleDocumentCreatePrefill', () => {
  it('builds order-from-offer href with sourceOfferId only', () => {
    const href = buildSimpleOrderCreateFromOfferHref('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    const qs = new URL(href, 'https://example.test').searchParams
    expect([...qs.keys()]).toEqual(['sourceOfferId'])
    expect(qs.get('sourceOfferId')).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  })

  it('reads sourceOfferId from search params (legacy sourceQuoteId fallback)', () => {
    expect(
      readSourceOfferIdFromSearchParams(
        new URLSearchParams({ sourceOfferId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }),
      ),
    ).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
    expect(
      readSourceOfferIdFromSearchParams(
        new URLSearchParams({ sourceQuoteId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }),
      ),
    ).toBe('cccccccc-cccc-4ccc-8ccc-cccccccccccc')
    expect(readSourceOfferIdFromSearchParams(new URLSearchParams({ sourceOfferId: 'nope' }))).toBe('')
  })

  it('reads linked order id from quote convertedOrderId or metadata', () => {
    expect(
      readLinkedOrderIdFromQuoteDoc({
        convertedOrderId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      }),
    ).toBe('cccccccc-cccc-4ccc-8ccc-cccccccccccc')
    expect(
      readLinkedOrderIdFromQuoteDoc({
        metadata: { simpleOrderId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' },
      }),
    ).toBe('dddddddd-dddd-4ddd-8ddd-dddddddddddd')
    expect(readLinkedOrderIdFromQuoteDoc({})).toBeNull()
  })
})
