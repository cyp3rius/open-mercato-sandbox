import { isDriverVisibleTripStatus } from '../driverVisibleTripStatuses'
import { defaultTripStatusCode } from '../tripStatuses'

describe('isDriverVisibleTripStatus', () => {
  it('allows scheduled, in_progress and completed', () => {
    expect(isDriverVisibleTripStatus('scheduled')).toBe(true)
    expect(isDriverVisibleTripStatus('in_progress')).toBe(true)
    expect(isDriverVisibleTripStatus('completed')).toBe(true)
  })

  it('hides CRM pipeline statuses', () => {
    expect(isDriverVisibleTripStatus('new')).toBe(false)
    expect(isDriverVisibleTripStatus('approved')).toBe(false)
    expect(isDriverVisibleTripStatus('paid')).toBe(false)
    expect(isDriverVisibleTripStatus('cancelled')).toBe(false)
  })
})

describe('defaultTripStatusCode', () => {
  it('prefers scheduled for CRM create defaults', () => {
    expect(
      defaultTripStatusCode([
        {
          code: 'new',
          label: 'Nowy',
          icon: '',
          color: '',
          sortOrder: 10,
          isTerminal: false,
          onEnterActions: [],
        },
        {
          code: 'scheduled',
          label: 'Do realizacji',
          icon: '',
          color: '',
          sortOrder: 40,
          isTerminal: false,
          onEnterActions: [],
        },
      ]),
    ).toBe('scheduled')
  })
})
