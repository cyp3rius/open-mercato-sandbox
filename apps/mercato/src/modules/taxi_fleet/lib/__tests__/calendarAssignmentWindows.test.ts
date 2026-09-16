import {
  isAdHocCalendarAssignment,
  mapAssignmentsToScheduleItems,
  resolveAssignmentWindow,
  type CalendarAssignment,
} from '../calendarScheduleItems'

const resolvers = {
  resolveDriverName: (id: string) => `Driver ${id.slice(0, 4)}`,
  resolveResourceLabel: (id: string) => `Car ${id.slice(0, 4)}`,
  resolveTripTypeLabel: (type: string) => type,
}

function assignment(partial: Partial<CalendarAssignment> & Pick<CalendarAssignment, 'id'>): CalendarAssignment {
  return {
    teamMemberId: '11111111-1111-4111-8111-111111111111',
    resourceId: '22222222-2222-4222-8222-222222222222',
    assignmentDate: '2026-09-16',
    status: 'confirmed',
    plannedShiftStart: null,
    plannedShiftEnd: null,
    shiftStart: null,
    shiftEnd: null,
    ...partial,
  }
}

describe('calendar assignment windows', () => {
  test('marks self-start rows without planned times as ad-hoc', () => {
    expect(
      isAdHocCalendarAssignment(
        assignment({
          id: 'a1',
          shiftStart: '2026-09-16T08:15:00.000Z',
          shiftEnd: '2026-09-16T14:00:00.000Z',
        }),
      ),
    ).toBe(true)
    expect(
      isAdHocCalendarAssignment(
        assignment({
          id: 'a2',
          plannedShiftStart: '2026-09-16T06:00:00.000Z',
          plannedShiftEnd: '2026-09-16T14:00:00.000Z',
        }),
      ),
    ).toBe(false)
  })

  test('uses punch times for completed ad-hoc shifts', () => {
    const window = resolveAssignmentWindow(
      assignment({
        id: 'a3',
        shiftStart: '2026-09-16T08:15:00.000Z',
        shiftEnd: '2026-09-16T14:05:00.000Z',
      }),
    )
    expect(window.start.toISOString()).toBe('2026-09-16T08:15:00.000Z')
    expect(window.end.toISOString()).toBe('2026-09-16T14:05:00.000Z')
  })

  test('keeps planned window for CRM-planned allocations', () => {
    const window = resolveAssignmentWindow(
      assignment({
        id: 'a4',
        plannedShiftStart: '2026-09-16T06:00:00.000Z',
        plannedShiftEnd: '2026-09-16T14:00:00.000Z',
        shiftStart: '2026-09-16T05:50:00.000Z',
        shiftEnd: '2026-09-16T14:10:00.000Z',
      }),
    )
    expect(window.start.toISOString()).toBe('2026-09-16T06:00:00.000Z')
    expect(window.end.toISOString()).toBe('2026-09-16T14:00:00.000Z')
  })

  test('includes ad-hoc assignments in schedule items', () => {
    const items = mapAssignmentsToScheduleItems(
      [
        assignment({
          id: 'adhoc-1',
          shiftStart: '2026-09-16T09:00:00.000Z',
          shiftEnd: '2026-09-16T12:00:00.000Z',
        }),
      ],
      resolvers,
    )
    expect(items).toHaveLength(1)
    expect(items[0]?.metadata?.adHoc).toBe(true)
    expect(items[0]?.startsAt.toISOString()).toBe('2026-09-16T09:00:00.000Z')
  })
})
