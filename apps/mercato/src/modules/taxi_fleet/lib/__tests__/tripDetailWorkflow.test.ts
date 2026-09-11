import {
  isTripDetailFieldEditable,
  tripDetailLockMode,
} from '../tripDetailWorkflow'

describe('tripDetailLockMode', () => {
  it('locks completed trips by default', () => {
    expect(tripDetailLockMode('completed')).toBe('full')
    expect(isTripDetailFieldEditable('completed', 'revenueAmount')).toBe(false)
  })

  it('unlocks completed trips when allowEditCompleted is set', () => {
    expect(tripDetailLockMode('completed', { allowEditCompleted: true })).toBe('none')
    expect(
      isTripDetailFieldEditable('completed', 'revenueAmount', { allowEditCompleted: true }),
    ).toBe(true)
  })

  it('keeps cancelled trips locked even with allowEditCompleted', () => {
    expect(tripDetailLockMode('cancelled', { allowEditCompleted: true })).toBe('full')
  })
})
