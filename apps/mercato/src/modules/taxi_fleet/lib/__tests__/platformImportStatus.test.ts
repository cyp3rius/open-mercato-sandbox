import {
  isCancelledPlatformImportStatus,
  isRealizedPlatformImportStatus,
} from '../platformSync/platformImportStatus'

describe('platformImportStatus', () => {
  it('detects cancelled vendor statuses', () => {
    expect(isCancelledPlatformImportStatus('cancelled')).toBe(true)
    expect(isCancelledPlatformImportStatus('rider_canceled')).toBe(true)
    expect(isCancelledPlatformImportStatus('driver_cancelled')).toBe(true)
    expect(isCancelledPlatformImportStatus('completed')).toBe(false)
    expect(isCancelledPlatformImportStatus('paid')).toBe(false)
  })

  it('accepts only completed and paid as realized', () => {
    expect(isRealizedPlatformImportStatus('completed')).toBe(true)
    expect(isRealizedPlatformImportStatus('paid')).toBe(true)
    expect(isRealizedPlatformImportStatus('cancelled')).toBe(false)
    expect(isRealizedPlatformImportStatus('new')).toBe(false)
  })
})
