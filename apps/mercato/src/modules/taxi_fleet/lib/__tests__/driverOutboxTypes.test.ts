import type { DriverOutboxItem } from '../driverOffline/outbox'

describe('driver outbox contract', () => {
  it('supports required mutation types for offline sync', () => {
    const types: DriverOutboxItem['type'][] = [
      'assignment.shift',
      'assignment.self_start',
      'trip.create',
      'trip.update',
      'location.batch',
      'expense.create',
    ]
    expect(new Set(types).size).toBe(6)
  })
})
