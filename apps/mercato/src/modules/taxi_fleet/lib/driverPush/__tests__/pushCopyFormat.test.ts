import {
  formatPushDateOnlyLabel,
  formatPushDateTimeLabel,
  formatPushMonthLabel,
  formatPushWeekRangeLabel,
} from '../pushCopyFormat'

describe('pushCopyFormat', () => {
  test('formatPushWeekRangeLabel matches Polish week copy', () => {
    expect(formatPushWeekRangeLabel('2026-09-07', 'pl')).toBe('7 - 13 wrzesień 2026')
  })

  test('formatPushWeekRangeLabel handles cross-month weeks', () => {
    expect(formatPushWeekRangeLabel('2026-08-31', 'pl')).toBe('31 sierpień - 6 wrzesień 2026')
  })

  test('formatPushMonthLabel matches Polish month copy', () => {
    expect(formatPushMonthLabel('2026-09-01', 'pl')).toBe('wrzesień 2026')
  })

  test('formatPushDateTimeLabel uses Warsaw clock', () => {
    const label = formatPushDateTimeLabel('2026-09-15T12:30:00.000Z', 'pl')
    expect(label).toMatch(/15 września 2026/)
    expect(label).toMatch(/14:30/)
  })

  test('formatPushDateOnlyLabel formats calendar day', () => {
    expect(formatPushDateOnlyLabel('2026-09-15', 'pl')).toBe('15 września 2026')
  })
})
