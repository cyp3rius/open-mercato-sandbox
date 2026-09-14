import { computeCasePlanCreateAt, casePlanItemIsDue } from '../casePlan'

describe('casePlan scheduling', () => {
  const now = new Date('2026-09-14T12:00:00.000Z')

  it('creates one-shot cases on startsAt', () => {
    expect(
      computeCasePlanCreateAt(
        {
          startsAt: '2026-09-20',
          recurrenceEnabled: false,
        },
        now,
      )?.toISOString().slice(0, 10),
    ).toBe('2026-09-20')
  })

  it('subtracts lead time for recurring cases', () => {
    expect(
      computeCasePlanCreateAt(
        {
          startsAt: '2026-09-20T00:00:00.000Z',
          recurrenceEnabled: true,
          recurrenceCreateLeadTime: { amount: 3, unit: 'days' },
        },
        now,
      )?.toISOString().slice(0, 10),
    ).toBe('2026-09-17')
  })

  it('marks items due when createAt is past', () => {
    expect(
      casePlanItemIsDue(
        {
          startsAt: '2026-09-10',
          recurrenceEnabled: false,
        },
        now,
      ),
    ).toBe(true)
    expect(
      casePlanItemIsDue(
        {
          startsAt: '2026-09-20',
          recurrenceEnabled: false,
        },
        now,
      ),
    ).toBe(false)
  })

  it('creates immediately when startsAt is missing', () => {
    expect(
      computeCasePlanCreateAt({ recurrenceEnabled: false }, now)?.getTime(),
    ).toBe(now.getTime())
  })
})
