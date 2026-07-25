import {
  calculateIncentiveAmount,
  isProgramValidOnDate,
  resolveIncentiveProgram,
  resolveOrderIncentiveBaseAmount,
  selectBestIncentiveProgram,
  summarizeLedgerBalances,
  toStoredAmount,
  type ProgramCandidateForIncentive,
} from '../incentiveCalculation'

describe('incentiveCalculation', () => {
  const baseDate = new Date('2026-07-01T12:00:00.000Z')

  const candidate = (
    partial: Partial<ProgramCandidateForIncentive> & Pick<ProgramCandidateForIncentive, 'programId' | 'incentivePercent'>,
  ): ProgramCandidateForIncentive => ({
    incentiveBase: 'net',
    isActive: true,
    validFrom: null,
    validTo: null,
    ...partial,
  })

  it('calculates percent of base amount to 4 decimal places', () => {
    expect(calculateIncentiveAmount(1000, 5)).toBe(50)
    expect(calculateIncentiveAmount(200, 2.5)).toBe(5)
    expect(calculateIncentiveAmount(0, 10)).toBe(0)
    expect(calculateIncentiveAmount(100, 0)).toBe(0)
  })

  it('selects the highest valid incentive percent among memberships', () => {
    const candidates: ProgramCandidateForIncentive[] = [
      candidate({ programId: 'a', incentivePercent: 3 }),
      candidate({ programId: 'b', incentivePercent: 7.5 }),
      candidate({ programId: 'c', incentivePercent: 10, isActive: false }),
      candidate({
        programId: 'd',
        incentivePercent: 12,
        validFrom: new Date('2026-08-01T00:00:00.000Z'),
      }),
    ]
    const best = selectBestIncentiveProgram(candidates, baseDate)
    expect(best?.programId).toBe('b')
    expect(best?.incentivePercent).toBe(7.5)
  })

  it('rejects programs outside validity window', () => {
    const program = candidate({
      programId: 'x',
      incentivePercent: 5,
      validFrom: new Date('2026-01-01T00:00:00.000Z'),
      validTo: new Date('2026-06-01T00:00:00.000Z'),
    })
    expect(isProgramValidOnDate(program, baseDate)).toBe(false)
  })

  it('uses explicitly selected program when valid', () => {
    const candidates: ProgramCandidateForIncentive[] = [
      candidate({ programId: 'a', incentivePercent: 3 }),
      candidate({ programId: 'b', incentivePercent: 7.5 }),
    ]
    expect(resolveIncentiveProgram(candidates, baseDate, 'a')?.programId).toBe('a')
  })

  it('falls back to highest percent when no program is selected', () => {
    const candidates: ProgramCandidateForIncentive[] = [
      candidate({ programId: 'a', incentivePercent: 3 }),
      candidate({ programId: 'b', incentivePercent: 7.5 }),
    ]
    expect(resolveIncentiveProgram(candidates, baseDate, null)?.programId).toBe('b')
  })

  it('resolves order base amount from net or gross', () => {
    const order = { grandTotalNetAmount: '100', grandTotalGrossAmount: '123' }
    expect(resolveOrderIncentiveBaseAmount(order, 'net')).toBe(100)
    expect(resolveOrderIncentiveBaseAmount(order, 'gross')).toBe(123)
  })

  it('summarizes earned and payable balances per currency', () => {
    const rows = summarizeLedgerBalances([
      { kind: 'accrual', amount: '50.0000', currencyCode: 'USD' },
      { kind: 'accrual', amount: '10', currencyCode: 'eur' },
      { kind: 'payout', amount: '-50.0000', currencyCode: 'USD' },
      { kind: 'accrual', amount: '5', currencyCode: 'USD' },
    ])
    expect(rows).toEqual([
      { currencyCode: 'EUR', totalEarned: 10, payable: 10 },
      { currencyCode: 'USD', totalEarned: 55, payable: 5 },
    ])
  })

  it('formats stored amounts with fixed decimals', () => {
    expect(toStoredAmount(50)).toBe('50.0000')
    expect(toStoredAmount(5.1)).toBe('5.1000')
  })
})
