import {
  isDriverTripFinishedStatus,
  isDriverVisibleTripStatus,
  resolveDriverFacingTripStatus,
} from '../driverVisibleTripStatuses'
import { defaultTripStatusCode } from '../tripStatuses'

describe('isDriverVisibleTripStatus', () => {
  it('allows scheduled, in_progress, pending_authorization and completed', () => {
    expect(isDriverVisibleTripStatus('scheduled')).toBe(true)
    expect(isDriverVisibleTripStatus('in_progress')).toBe(true)
    expect(isDriverVisibleTripStatus('pending_authorization')).toBe(true)
    expect(isDriverVisibleTripStatus('completed')).toBe(true)
  })

  it('hides CRM pipeline statuses', () => {
    expect(isDriverVisibleTripStatus('new')).toBe(false)
    expect(isDriverVisibleTripStatus('approved')).toBe(false)
    expect(isDriverVisibleTripStatus('paid')).toBe(false)
    expect(isDriverVisibleTripStatus('cancelled')).toBe(false)
  })
})

describe('resolveDriverFacingTripStatus', () => {
  it('maps pending_authorization to completed for driver UI', () => {
    expect(resolveDriverFacingTripStatus('pending_authorization')).toBe('completed')
    expect(resolveDriverFacingTripStatus('completed')).toBe('completed')
    expect(resolveDriverFacingTripStatus('scheduled')).toBe('scheduled')
  })
})

describe('isDriverTripFinishedStatus', () => {
  it('treats pending_authorization as finished', () => {
    expect(isDriverTripFinishedStatus('pending_authorization')).toBe(true)
    expect(isDriverTripFinishedStatus('completed')).toBe(true)
    expect(isDriverTripFinishedStatus('in_progress')).toBe(false)
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
