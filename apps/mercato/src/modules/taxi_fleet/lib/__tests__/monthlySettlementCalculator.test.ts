import { aggregateMonthlySettlementFromWeeklies } from '../monthlySettlementCalculator'

describe('monthlySettlementCalculator', () => {
  it('aggregates weekly settlements by driver and month', () => {
    const result = aggregateMonthlySettlementFromWeeklies(
      [
        {
          id: 'w1',
          teamMemberId: 'driver-a',
          weekStart: '2026-07-07',
          revenueGross: '100',
          revenueNet: '92.59',
          costsGross: '10',
          costsNet: '8.13',
          netAmount: '84.46',
          payoutAmount: '42.23',
          totalDistanceKm: '100',
          cashExpected: '20',
          cashCollected: '18',
          bonusAmount: '5',
          compensationAmount: '2',
          airportA4Amount: '1',
          transferAmount: '25.23',
          snapshotJson: {
            revenueBreakdown: {
              uber_platform: 50,
              bolt_platform: 0,
              uber_cash: 20,
              taxi_cash: 30,
              taxi_card: 0,
              free: 0,
              other: 0,
            },
          },
        },
        {
          id: 'w2',
          teamMemberId: 'driver-a',
          weekStart: '2026-07-14',
          revenueGross: '200',
          revenueNet: '185.19',
          costsGross: '20',
          costsNet: '16.26',
          netAmount: '168.93',
          payoutAmount: '84.47',
          totalDistanceKm: '150',
          cashExpected: '30',
          cashCollected: '30',
          bonusAmount: '0',
          compensationAmount: '0',
          airportA4Amount: '0',
          transferAmount: '54.47',
          snapshotJson: {
            revenueBreakdown: {
              uber_platform: 100,
              bolt_platform: 0,
              uber_cash: 0,
              taxi_cash: 100,
              taxi_card: 0,
              free: 0,
              other: 0,
            },
          },
        },
        {
          id: 'w3',
          teamMemberId: 'driver-b',
          weekStart: '2026-07-07',
          revenueGross: '50',
          revenueNet: '46.30',
          costsGross: '5',
          costsNet: '4.07',
          netAmount: '42.23',
          payoutAmount: '21.12',
          totalDistanceKm: '80',
          cashExpected: '10',
          cashCollected: '10',
          bonusAmount: '1',
          compensationAmount: '0',
          airportA4Amount: '0',
          transferAmount: '12.12',
          snapshotJson: null,
        },
      ],
      '2026-07-01',
    )

    expect(result.weeklyCount).toBe(3)
    expect(result.driverCount).toBe(2)
    expect(result.revenueGross).toBeCloseTo(350, 2)
    expect(result.transferAmount).toBeCloseTo(91.82, 2)
    expect(result.totalAmount).toBeCloseTo(99.82, 2)
    expect(result.snapshot.revenueBreakdown.uber_platform).toBe(150)
    expect(result.snapshot.revenueBreakdown.taxi_cash).toBe(130)

    const driverA = result.snapshot.driverBreakdown.find((line) => line.teamMemberId === 'driver-a')
    expect(driverA?.weeklyCount).toBe(2)
    expect(driverA?.totalDistanceKm).toBe(250)
    expect(driverA?.totalAmount).toBeCloseTo(86.7, 2)
  })
})
