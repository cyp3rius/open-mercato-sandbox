import { scheduleNextRecurrenceOnClose } from '../scheduleNextRecurrenceOnClose'
import type { ServiceCase } from '../../data/entities'

describe('scheduleNextRecurrenceOnClose', () => {
  it('sets next occurrence from closedAt + interval', () => {
    const closedAt = new Date('2026-07-01T12:00:00.000Z')
    const caseRow = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      recurrenceEnabled: true,
      recurrenceSeriesId: null,
      recurrenceIntervalAmount: 7,
      recurrenceIntervalUnit: 'days',
      recurrenceNextOccurrenceAt: null,
    } as unknown as ServiceCase

    scheduleNextRecurrenceOnClose(caseRow, closedAt)

    expect(caseRow.recurrenceSeriesId).toBe(caseRow.id)
    expect(caseRow.recurrenceNextOccurrenceAt?.toISOString()).toBe('2026-07-08T12:00:00.000Z')
  })

  it('no-ops when recurrence is disabled', () => {
    const caseRow = {
      recurrenceEnabled: false,
      recurrenceIntervalAmount: 1,
      recurrenceIntervalUnit: 'days',
      recurrenceNextOccurrenceAt: null,
    } as unknown as ServiceCase
    scheduleNextRecurrenceOnClose(caseRow, new Date())
    expect(caseRow.recurrenceNextOccurrenceAt).toBeNull()
  })
})
