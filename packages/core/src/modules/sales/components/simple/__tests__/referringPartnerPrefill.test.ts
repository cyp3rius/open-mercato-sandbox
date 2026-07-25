import {
  resolveReferringPartnerFromDealApi,
  resolveReferringPartnerFromQuoteDoc,
} from '../referringPartnerPrefill'

describe('referringPartnerPrefill', () => {
  it('prefers deal.referringPartnerEntityId and keeps association label', () => {
    expect(
      resolveReferringPartnerFromDealApi({
        deal: { referringPartnerEntityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
        referringPartner: {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          label: 'Partner Co',
        },
      }),
    ).toEqual({
      referringPartnerEntityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      referringPartnerLabel: 'Partner Co',
    })
  })

  it('falls back to referringPartner association id when deal field is empty', () => {
    expect(
      resolveReferringPartnerFromDealApi({
        deal: { referringPartnerEntityId: null },
        referringPartner: {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          label: 'Partner Co',
        },
      }),
    ).toEqual({
      referringPartnerEntityId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      referringPartnerLabel: 'Partner Co',
    })
  })

  it('reads referring partner id from quote document for order prefill', () => {
    expect(
      resolveReferringPartnerFromQuoteDoc({
        referringPartnerEntityId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      }),
    ).toBe('cccccccc-cccc-4ccc-8ccc-cccccccccccc')
    expect(resolveReferringPartnerFromQuoteDoc({})).toBe('')
  })
})
