import {
  parseUberFleetCsvFilenameRange,
  uberFleetCsvFilenameRangesMatch,
} from '../platformSync/uberFleetCsvFilename'

describe('uberFleetCsvFilename', () => {
  it('parses trip_activity and payments_order ranges', () => {
    expect(
      parseUberFleetCsvFilenameRange('20260801-20260807-trip_activity-fleet.csv'),
    ).toEqual({
      from: '20260801',
      to: '20260807',
      kind: 'trip_activity',
    })
    expect(
      parseUberFleetCsvFilenameRange('20260801-20260807-payments_order-xyz.csv'),
    ).toEqual({
      from: '20260801',
      to: '20260807',
      kind: 'payments_order',
    })
  })

  it('returns null when pattern is missing', () => {
    expect(parseUberFleetCsvFilenameRange('random-export.csv')).toBeNull()
    expect(parseUberFleetCsvFilenameRange('')).toBeNull()
  })

  it('blocks submit only when both ranges exist and differ', () => {
    expect(
      uberFleetCsvFilenameRangesMatch(
        '20260801-20260807-trip_activity.csv',
        '20260801-20260807-payments_order.csv',
      ).ok,
    ).toBe(true)
    expect(
      uberFleetCsvFilenameRangesMatch('no-range.csv', '20260801-20260807-payments_order.csv').ok,
    ).toBe(true)
    const mismatch = uberFleetCsvFilenameRangesMatch(
      '20260801-20260807-trip_activity.csv',
      '20260808-20260814-payments_order.csv',
    )
    expect(mismatch.ok).toBe(false)
  })
})
