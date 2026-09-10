import {
  aggregateMonthlyCashFromWeeklies,
  buildMonthlySettlementCostLines,
  buildMonthlySettlementSegmentDefs,
  buildMonthlySettlementSegments,
  buildMonthlySettlementTripLines,
  buildNonPlatformRevenueFromCalendarTrips,
  collectAlreadySettledPlatformTripIds,
  collectPriorStraddleAttributedPayouts,
  computeLeadingRemainderPayout,
  filterPlatformTripsForMonthly,
  indexTripIdsToWeeklyFromSnapshots,
  indexWeeklySettlementsByWeekStart,
  isPlatformSettlementRevenueLine,
  isTrailingPartialWeekSegment,
  mergeRevenueBreakdowns,
  resolveWeeklyLinkForDate,
} from '../monthlySettlementCalculator'
import { classifySettlementRevenueLine } from '../settlementRevenue'
import { isMonthFullyCompleted } from '../weekUtils'

describe('monthlySettlementCalculator helpers', () => {
  it('aggregates cash expected and collected from weeklies in the month', () => {
    expect(
      aggregateMonthlyCashFromWeeklies([
        { cashExpected: '100.50', cashCollected: '80' },
        { cashExpected: 50, cashCollected: 50 },
        { cashExpected: null, cashCollected: undefined },
      ]),
    ).toEqual({ cashExpected: 150.5, cashCollected: 130 })
  })

  it('computes leading remainder and collects prior trailing attributions', () => {
    expect(computeLeadingRemainderPayout({ weeklyPayoutAmount: 1000, priorAttributedPayout: 350 })).toBe(
      650,
    )
    expect(computeLeadingRemainderPayout({ weeklyPayoutAmount: 100, priorAttributedPayout: 150 })).toBe(0)
    expect(
      isTrailingPartialWeekSegment({
        kind: 'week',
        weekStart: '2026-09-28',
        dateTo: '2026-09-30',
      }),
    ).toBe(true)
    expect(
      isTrailingPartialWeekSegment({
        kind: 'week',
        weekStart: '2026-09-07',
        dateTo: '2026-09-13',
      }),
    ).toBe(false)

    const attributed = collectPriorStraddleAttributedPayouts([
      {
        snapshotJson: {
          segments: [
            {
              id: 'trailing',
              kind: 'week',
              dateFrom: '2026-08-31',
              dateTo: '2026-08-31',
              weekStart: '2026-08-31',
              payoutAmount: 350,
              revenueGross: 0,
              revenueNet: 0,
              costsGross: 0,
              costsNet: 0,
              netAmount: 0,
              payoutPercent: 40,
              payoutResolution: { mode: 'fixed', percent: 40, selectionNetAmount: 0, matchedTier: null },
              weeklySettlementId: 'w1',
              nonPlatformTripIds: [],
              platformTripIds: [],
              costEntryIds: [],
            },
          ],
        },
      },
    ])
    expect(attributed.get('2026-08-31')).toBe(350)
  })

  it('classifies platform revenue lines', () => {
    expect(isPlatformSettlementRevenueLine('uber_platform')).toBe(true)
    expect(isPlatformSettlementRevenueLine('bolt_platform')).toBe(true)
    expect(isPlatformSettlementRevenueLine('free')).toBe(true)
    expect(isPlatformSettlementRevenueLine('uber_cash')).toBe(true)
    expect(isPlatformSettlementRevenueLine('taxi_cash')).toBe(false)
    expect(isPlatformSettlementRevenueLine('taxi_card')).toBe(false)
  })

  it('builds non-platform revenue from calendar trips and cash expected from all cash trips', () => {
    const result = buildNonPlatformRevenueFromCalendarTrips([
      {
        id: 't1',
        status: 'completed',
        platform: null,
        revenueAmount: '100',
        metadata: { tripRequest: { paymentType: 'cash' } },
      },
      {
        id: 't2',
        status: 'completed',
        platform: 'uber',
        revenueAmount: '50',
        metadata: { tripRequest: { paymentType: 'electronic' } },
      },
      {
        id: 't3',
        status: 'completed',
        platform: 'bolt',
        revenueAmount: '40',
        metadata: { tripRequest: { paymentType: 'cash' } },
      },
    ])
    expect(result.revenueGross).toBe(100)
    expect(result.breakdown.taxi_cash).toBe(100)
    expect(result.breakdown.uber_platform).toBe(0)
    expect(result.cashExpected).toBe(140)
    expect(result.nonPlatformTripIds).toEqual(['t1'])
  })

  it('skips platform trips already settled in prior months', () => {
    const already = new Set(['trip-a'])
    const filtered = filterPlatformTripsForMonthly(
      [
        {
          id: 'trip-a',
          status: 'completed',
          platform: 'uber',
          revenueAmount: '80',
          metadata: { tripRequest: { paymentType: 'electronic' } },
        },
        {
          id: 'trip-b',
          status: 'completed',
          platform: 'bolt',
          revenueAmount: '60',
          metadata: { tripRequest: { paymentType: 'card' } },
        },
        {
          id: 'trip-c',
          status: 'completed',
          platform: null,
          revenueAmount: '30',
          metadata: { tripRequest: { paymentType: 'cash' } },
        },
      ],
      already,
    )
    expect(filtered.platformTripIds).toEqual(['trip-b'])
    expect(filtered.skippedAlreadySettled).toEqual(['trip-a'])
    expect(filtered.included).toHaveLength(1)
  })

  it('collects platformTripIds from prior monthly snapshots', () => {
    const ids = collectAlreadySettledPlatformTripIds([
      { snapshotJson: { platformTripIds: ['a', 'b'] } },
      { snapshotJson: { platformTripIds: ['b', 'c'] } },
      { snapshotJson: null },
    ])
    expect([...ids].sort()).toEqual(['a', 'b', 'c'])
  })

  it('merges revenue breakdowns', () => {
    const merged = mergeRevenueBreakdowns(
      {
        uber_platform: 10,
        bolt_platform: 0,
        uber_cash: 0,
        taxi_cash: 5,
        taxi_card: 0,
        free: 0,
        other: 0,
      },
      {
        uber_platform: 2,
        bolt_platform: 7,
        uber_cash: 0,
        taxi_cash: 0,
        taxi_card: 1,
        free: 3,
        other: 0,
      },
    )
    expect(merged.uber_platform).toBe(12)
    expect(merged.bolt_platform).toBe(7)
    expect(merged.taxi_cash).toBe(5)
    expect(merged.taxi_card).toBe(1)
    expect(merged.free).toBe(3)
  })

  it('gates month completion', () => {
    expect(isMonthFullyCompleted('2026-01-01', new Date('2026-02-01T12:00:00Z'))).toBe(true)
    expect(isMonthFullyCompleted('2026-09-01', new Date('2026-09-15T12:00:00Z'))).toBe(false)
    expect(isMonthFullyCompleted('2026-09-15', new Date('2026-10-01T12:00:00Z'))).toBe(false)
  })

  it('keeps classifySettlementRevenueLine aligned with platform filter', () => {
    expect(
      classifySettlementRevenueLine({ platform: 'uber', paymentType: 'electronic' }),
    ).toBe('uber_platform')
    expect(classifySettlementRevenueLine({ platform: 'uber', paymentType: 'cash' })).toBe('uber_cash')
  })

  it('builds September 2026 segment defs with leading and straddle cash range', () => {
    const defs = buildMonthlySettlementSegmentDefs('2026-09-01')
    expect(defs[0]).toMatchObject({
      kind: 'leading',
      dateFrom: '2026-09-01',
      dateTo: '2026-09-06',
      weekStart: '2026-08-31',
    })
    expect(defs.map((d) => d.weekStart).filter(Boolean)).toEqual([
      '2026-08-31',
      '2026-09-07',
      '2026-09-14',
      '2026-09-21',
      '2026-09-28',
    ])
    const last = defs[defs.length - 1]!
    expect(last).toMatchObject({
      kind: 'week',
      weekStart: '2026-09-28',
      dateFrom: '2026-09-28',
      dateTo: '2026-09-30',
    })
  })

  it('pays leading as weekly remainder after prior trailing attribution', () => {
    const defs = buildMonthlySettlementSegmentDefs('2026-09-01').filter(
      (def) => def.kind === 'leading' || def.weekStart === '2026-09-28',
    )
    const weekliesByWeekStart = new Map([
      [
        '2026-08-31',
        {
          id: 'weekly-aug-31',
          weekStart: '2026-08-31',
          payoutAmount: '1000',
          snapshotJson: { trips: [] },
        },
      ],
      [
        '2026-09-28',
        {
          id: 'weekly-sep-28',
          weekStart: '2026-09-28',
          payoutAmount: '800',
          snapshotJson: {
            trips: [
              {
                id: 'bolt-straddle',
                status: 'completed',
                platform: 'bolt',
                revenueAmount: 2000,
                paymentType: 'electronic',
              },
            ],
          },
        },
      ],
    ])

    const built = buildMonthlySettlementSegments({
      defs,
      calendarTrips: [
        {
          id: 'taxi-leading',
          status: 'completed',
          platform: null,
          revenueAmount: '100',
          startedAt: new Date('2026-09-02T10:00:00Z'),
          metadata: { tripRequest: { paymentType: 'cash' } },
        },
        {
          id: 'taxi-straddle-cash',
          status: 'completed',
          platform: null,
          revenueAmount: '50',
          startedAt: new Date('2026-09-29T10:00:00Z'),
          metadata: { tripRequest: { paymentType: 'cash' } },
        },
      ],
      costEntries: [],
      weekliesByWeekStart,
      alreadySettled: new Set(),
      priorStraddleAttributedByWeekStart: new Map([['2026-08-31', 350]]),
      payoutSchedule: {
        mode: 'fixed',
        fixedPercent: 50,
        tiers: null,
      },
      payoutPercent: 50,
    })

    const leading = built.segments.find((s) => s.kind === 'leading')!
    expect(leading.weekStart).toBe('2026-08-31')
    expect(leading.weeklySettlementId).toBe('weekly-aug-31')
    expect(leading.payoutAmount).toBe(650)
    expect(leading.straddle).toEqual({
      role: 'leading_remainder',
      weeklyPayoutAmount: 1000,
      priorAttributedPayout: 350,
    })
    expect(leading.payoutResolution.mode).toBe('weekly_remainder')

    const trailing = built.segments.find((s) => s.weekStart === '2026-09-28')!
    expect(trailing.straddle?.role).toBe('trailing_partial')
    expect(trailing.straddle?.weeklyPayoutAmount).toBe(800)
  })

  it('computes per-segment payout percents and skips already settled platforms', () => {
    const defs = buildMonthlySettlementSegmentDefs('2026-09-01').filter(
      (def) => def.kind === 'leading' || def.weekStart === '2026-09-07' || def.weekStart === '2026-09-28',
    )
    const weekliesByWeekStart = new Map([
      [
        '2026-09-07',
        {
          id: 'weekly-sep-07',
          weekStart: '2026-09-07',
          snapshotJson: {
            trips: [
              {
                id: 'uber-already',
                status: 'completed',
                platform: 'uber',
                revenueAmount: 500,
                paymentType: 'electronic',
              },
              {
                id: 'uber-new',
                status: 'completed',
                platform: 'uber',
                revenueAmount: 1000,
                paymentType: 'electronic',
              },
            ],
          },
        },
      ],
      [
        '2026-09-28',
        {
          id: 'weekly-sep-28',
          weekStart: '2026-09-28',
          snapshotJson: {
            trips: [
              {
                id: 'bolt-straddle',
                status: 'completed',
                platform: 'bolt',
                revenueAmount: 2000,
                paymentType: 'electronic',
              },
            ],
          },
        },
      ],
    ])

    const built = buildMonthlySettlementSegments({
      defs,
      calendarTrips: [
        {
          id: 'taxi-leading',
          status: 'completed',
          platform: null,
          revenueAmount: '100',
          startedAt: new Date('2026-09-02T10:00:00Z'),
          metadata: { tripRequest: { paymentType: 'cash' } },
        },
        {
          id: 'taxi-week',
          status: 'completed',
          platform: null,
          revenueAmount: '200',
          startedAt: new Date('2026-09-08T10:00:00Z'),
          metadata: { tripRequest: { paymentType: 'cash' } },
        },
        {
          id: 'taxi-straddle-cash',
          status: 'completed',
          platform: null,
          revenueAmount: '50',
          startedAt: new Date('2026-09-29T10:00:00Z'),
          metadata: { tripRequest: { paymentType: 'cash' } },
        },
      ],
      costEntries: [],
      weekliesByWeekStart,
      alreadySettled: new Set(['uber-already']),
      payoutSchedule: {
        mode: 'tiered',
        fixedPercent: 50,
        tiers: [
          { fromAmount: 0, toAmount: 500, percent: 40 },
          { fromAmount: 500, toAmount: null, percent: 60 },
        ],
      },
    })

    expect(built.skippedAlreadySettled).toContain('uber-already')
    expect(built.platformTripIds).toEqual(['uber-new', 'bolt-straddle'])

    const leading = built.segments.find((s) => s.kind === 'leading')!
    expect(leading.payoutPercent).toBe(0)
    expect(leading.platformTripIds).toEqual([])
    // No weekly for 2026-08-31 in this fixture → remainder of 0
    expect(leading.straddle?.role).toBe('leading_remainder')
    expect(leading.payoutAmount).toBe(0)
    expect(leading.payoutResolution.mode).toBe('weekly_remainder')

    const mid = built.segments.find((s) => s.weekStart === '2026-09-07')!
    expect(mid.platformTripIds).toEqual(['uber-new'])
    expect(mid.payoutPercent).toBe(60)
    expect(mid.weeklySettlementId).toBe('weekly-sep-07')

    const straddle = built.segments.find((s) => s.weekStart === '2026-09-28')!
    expect(straddle.dateTo).toBe('2026-09-30')
    expect(straddle.platformTripIds).toEqual(['bolt-straddle'])
    expect(straddle.nonPlatformTripIds).toEqual(['taxi-straddle-cash'])
    expect(straddle.payoutPercent).toBe(60)

    expect(built.segmentsPayoutBase).toBeCloseTo(
      leading.payoutAmount + mid.payoutAmount + straddle.payoutAmount,
      5,
    )
  })

  it('attaches weekly settlement links to monthly trip and cost lines', () => {
    const weeklies = [
      {
        id: 'weekly-1',
        weekStart: '2026-08-31',
        snapshotJson: {
          trips: [{ id: 'taxi-1', status: 'completed', revenueAmount: 100, tripType: 'standard' }],
        },
      },
      {
        id: 'weekly-2',
        weekStart: '2026-09-07',
        snapshotJson: {
          trips: [
            {
              id: 'uber-1',
              status: 'completed',
              platform: 'uber',
              revenueAmount: 80,
              tripType: 'standard',
              paymentType: 'electronic',
            },
          ],
        },
      },
    ]
    const tripIdToWeekly = indexTripIdsToWeeklyFromSnapshots(weeklies)
    const weekliesByWeekStart = indexWeeklySettlementsByWeekStart(weeklies)

    expect(tripIdToWeekly.get('taxi-1')?.id).toBe('weekly-1')
    expect(resolveWeeklyLinkForDate('2026-09-09T10:00:00.000Z', weekliesByWeekStart)?.id).toBe(
      'weekly-2',
    )
    expect(resolveWeeklyLinkForDate('2026-09-01T10:00:00.000Z', weekliesByWeekStart)?.id).toBe(
      'weekly-1',
    )
    expect(resolveWeeklyLinkForDate(null, weekliesByWeekStart)).toBeNull()

    const trips = buildMonthlySettlementTripLines({
      calendarTrips: [
        {
          id: 'taxi-1',
          status: 'completed',
          tripType: 'standard',
          platform: null,
          revenueAmount: '100',
          distanceKm: '12',
          startedAt: new Date('2026-09-02T08:00:00Z'),
          metadata: { tripRequest: { paymentType: 'cash' } },
        },
      ],
      nonPlatformTripIds: ['taxi-1'],
      platformTripIds: ['uber-1'],
      weekliesInMonth: [weeklies[1]!],
      tripIdToWeekly,
    })
    expect(trips).toHaveLength(2)
    expect(trips.find((trip) => trip.id === 'taxi-1')?.weeklySettlementId).toBe('weekly-1')
    expect(trips.find((trip) => trip.id === 'uber-1')?.weeklySettlementId).toBe('weekly-2')
    expect(trips.find((trip) => trip.id === 'uber-1')?.inclusionSource).toBe('platform_weekly')

    const costs = buildMonthlySettlementCostLines({
      entries: [
        {
          id: 'cost-1',
          costType: 'fuel',
          tripId: null,
          amount: 50,
          vatRatePercent: 23,
          netAmount: 40.65,
          currencyCode: 'PLN',
          documentNumber: null,
          occurredAt: '2026-09-09T12:00:00.000Z',
          notes: null,
          receiptAttachmentId: null,
        },
        {
          id: 'cost-orphan',
          costType: 'other',
          tripId: null,
          amount: 10,
          vatRatePercent: 23,
          netAmount: 8.13,
          currencyCode: 'PLN',
          documentNumber: null,
          occurredAt: '2026-07-01T12:00:00.000Z',
          notes: null,
          receiptAttachmentId: null,
        },
      ],
      weekliesByWeekStart,
    })
    expect(costs[0]?.weeklySettlementId).toBe('weekly-2')
    expect(costs[1]?.weeklySettlementId).toBeNull()
  })
})
