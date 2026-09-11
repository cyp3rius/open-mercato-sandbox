/**
 * @jest-environment jsdom
 */
import {
  DRIVER_GPS_GRANTED_KEY,
  readDriverGpsGranted,
  writeDriverGpsGranted,
} from '../useDriverGpsStatus'

describe('driver GPS grant persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('persists grant in localStorage (survives logout clearing session keys)', () => {
    expect(readDriverGpsGranted()).toBe(false)
    writeDriverGpsGranted()
    expect(localStorage.getItem(DRIVER_GPS_GRANTED_KEY)).toBe('1')
    expect(readDriverGpsGranted()).toBe(true)
  })
})
