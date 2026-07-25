import {
  buildCaseCreateHref,
  buildPolicyCreateHref,
  buildSimpleDealCreateHref,
  buildSimpleOrderCreateHref,
  buildSimpleQuoteCreateFromDealHref,
  buildSimpleQuoteCreateHref,
  readCustomerEntityIdFromSearchParams,
  readOwnerUserIdFromSearchParams,
} from '../customerEntityCreatePrefill'

describe('customerEntityCreatePrefill', () => {
  const personInput = {
    customerEntityId: '11111111-1111-4111-8111-111111111111',
    ownerUserId: '22222222-2222-4222-8222-222222222222',
    kind: 'person' as const,
  }
  const companyInput = {
    customerEntityId: '33333333-3333-4333-8333-333333333333',
    ownerUserId: null,
    kind: 'company' as const,
  }

  it('builds person deep-links with personId only (not customerEntityId)', () => {
    const href = buildSimpleQuoteCreateHref(personInput)
    const qs = new URL(href, 'https://example.test').searchParams
    expect(qs.get('personId')).toBe(personInput.customerEntityId)
    expect(qs.get('companyId')).toBeNull()
    expect(qs.get('customerEntityId')).toBeNull()
    expect(qs.get('ownerUserId')).toBe(personInput.ownerUserId)
  })

  it('builds company deep-links with companyId only', () => {
    const href = buildSimpleOrderCreateHref(companyInput)
    const qs = new URL(href, 'https://example.test').searchParams
    expect(qs.get('companyId')).toBe(companyInput.customerEntityId)
    expect(qs.get('personId')).toBeNull()
    expect(qs.get('customerEntityId')).toBeNull()
    expect(qs.get('ownerUserId')).toBeNull()
  })

  it('applies the same kind-specific params across create targets', () => {
    for (const build of [
      buildSimpleDealCreateHref,
      buildCaseCreateHref,
      buildPolicyCreateHref,
    ]) {
      const qs = new URL(build(personInput), 'https://example.test').searchParams
      expect(qs.get('personId')).toBe(personInput.customerEntityId)
      expect(qs.get('customerEntityId')).toBeNull()
    }
  })

  it('builds quote-from-deal href with sourceDealId only', () => {
    const href = buildSimpleQuoteCreateFromDealHref('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    const qs = new URL(href, 'https://example.test').searchParams
    expect([...qs.keys()]).toEqual(['sourceDealId'])
    expect(qs.get('sourceDealId')).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  })

  it('reads customer entity id preferring personId/companyId over legacy customerEntityId', () => {
    const params = new URLSearchParams({
      personId: personInput.customerEntityId,
      customerEntityId: companyInput.customerEntityId,
    })
    expect(readCustomerEntityIdFromSearchParams(params)).toBe(personInput.customerEntityId)
    expect(readOwnerUserIdFromSearchParams(new URLSearchParams({ ownerUserId: personInput.ownerUserId }))).toBe(
      personInput.ownerUserId,
    )
  })
})
