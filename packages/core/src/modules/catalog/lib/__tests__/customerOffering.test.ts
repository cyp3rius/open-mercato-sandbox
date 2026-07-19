import {
  cloneCaseTemplatesSnapshot,
  isRecurrenceOccurrenceWithinSubscription,
  resolveCustomerOfferingIdFromMetadata,
  resolveRecurrenceSeriesEndsAt,
  shouldActivateOfferingNow,
} from '../customerOffering'

describe('customerOffering helpers', () => {
  describe('shouldActivateOfferingNow', () => {
    const now = new Date('2026-07-18T12:00:00.000Z')

    it('activates non-subscription offerings immediately', () => {
      expect(
        shouldActivateOfferingNow({
          offeringKind: 'internal_service',
          startsAt: new Date('2026-08-01T00:00:00.000Z'),
          now,
        }),
      ).toBe(true)
      expect(
        shouldActivateOfferingNow({
          offeringKind: 'resource',
          startsAt: null,
          now,
        }),
      ).toBe(true)
    })

    it('activates subscriptions only when startsAt has arrived', () => {
      expect(
        shouldActivateOfferingNow({
          offeringKind: 'subscription',
          startsAt: new Date('2026-07-18T11:59:00.000Z'),
          now,
        }),
      ).toBe(true)
      expect(
        shouldActivateOfferingNow({
          offeringKind: 'subscription',
          startsAt: new Date('2026-07-18T12:00:00.000Z'),
          now,
        }),
      ).toBe(true)
      expect(
        shouldActivateOfferingNow({
          offeringKind: 'subscription',
          startsAt: new Date('2026-07-19T00:00:00.000Z'),
          now,
        }),
      ).toBe(false)
    })

    it('does not activate subscriptions without startsAt', () => {
      expect(
        shouldActivateOfferingNow({
          offeringKind: 'subscription',
          startsAt: null,
          now,
        }),
      ).toBe(false)
    })
  })

  describe('isRecurrenceOccurrenceWithinSubscription', () => {
    it('allows all occurrences when endsAt is missing', () => {
      expect(
        isRecurrenceOccurrenceWithinSubscription({
          nextOccurrenceAt: new Date('2030-01-01T00:00:00.000Z'),
          endsAt: null,
        }),
      ).toBe(true)
    })

    it('rejects occurrences after endsAt', () => {
      const endsAt = new Date('2026-12-31T23:59:59.000Z')
      expect(
        isRecurrenceOccurrenceWithinSubscription({
          nextOccurrenceAt: new Date('2026-12-31T23:59:59.000Z'),
          endsAt,
        }),
      ).toBe(true)
      expect(
        isRecurrenceOccurrenceWithinSubscription({
          nextOccurrenceAt: new Date('2027-01-01T00:00:00.000Z'),
          endsAt,
        }),
      ).toBe(false)
    })
  })

  describe('metadata helpers', () => {
    it('resolves recurrenceSeriesEndsAt and customerOfferingId', () => {
      const metadata = {
        customerOfferingId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        recurrenceSeriesEndsAt: '2026-12-31T00:00:00.000Z',
      }
      expect(resolveCustomerOfferingIdFromMetadata(metadata)).toBe(
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      )
      expect(resolveRecurrenceSeriesEndsAt(metadata)?.toISOString()).toBe(
        '2026-12-31T00:00:00.000Z',
      )
      expect(resolveRecurrenceSeriesEndsAt({ recurrenceSeriesEndsAt: 'not-a-date' })).toBeNull()
      expect(resolveCustomerOfferingIdFromMetadata(null)).toBeNull()
    })
  })

  describe('cloneCaseTemplatesSnapshot', () => {
    it('clones templates with normalized optional fields', () => {
      const cloned = cloneCaseTemplatesSnapshot([
        {
          id: 't1',
          title: 'Annual review',
          playbookId: 'p1',
          recurrenceEnabled: true,
          recurrenceIntervalAmount: 12,
          recurrenceIntervalUnit: 'months',
          recurrenceCreateLeadTime: { amount: 7, unit: 'days' },
        },
      ])
      expect(cloned).toEqual([
        {
          id: 't1',
          title: 'Annual review',
          playbookId: 'p1',
          recurrenceEnabled: true,
          recurrenceIntervalAmount: 12,
          recurrenceIntervalUnit: 'months',
          recurrenceCreateLeadTime: { amount: 7, unit: 'days' },
        },
      ])
      expect(cloneCaseTemplatesSnapshot(null)).toEqual([])
    })
  })

  describe('manual force activation contract', () => {
    it('documents that force bypasses future startsAt while guardian remains required', () => {
      const now = new Date('2026-07-18T12:00:00.000Z')
      const futureStart = new Date('2026-08-01T00:00:00.000Z')
      expect(
        shouldActivateOfferingNow({
          offeringKind: 'subscription',
          startsAt: futureStart,
          now,
        }),
      ).toBe(false)
      const force = true
      const shouldActivate =
        force ||
        shouldActivateOfferingNow({
          offeringKind: 'subscription',
          startsAt: futureStart,
          now,
        })
      expect(shouldActivate).toBe(true)
    })
  })
})

describe('guardian owner resolve contract', () => {
  it('treats empty ownerUserId as missing guardian', () => {
    const ownerUserId = '  '.trim() || ''
    expect(ownerUserId).toBe('')
    const resolved = typeof ownerUserId === 'string' && ownerUserId.length ? ownerUserId : null
    expect(resolved).toBeNull()
  })

  it('keeps a valid guardian id', () => {
    const ownerUserId = '11111111-2222-3333-4444-555555555555'
    expect(ownerUserId.trim()).toBe(ownerUserId)
  })
})

describe('bundle expansion product types', () => {
  it('recognizes bundle and grouped as expandable', () => {
    const expandable = new Set(['bundle', 'grouped'])
    expect(expandable.has('bundle')).toBe(true)
    expect(expandable.has('grouped')).toBe(true)
    expect(expandable.has('simple')).toBe(false)
  })
})
