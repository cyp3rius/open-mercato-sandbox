import { mergeReceiptTripDistance, readTripRouteDistanceKm } from '../receiptTripDistanceApply'

describe('receiptTripDistanceApply', () => {
  it('fills empty trip distance from OCR', () => {
    const result = mergeReceiptTripDistance({
      tripDistanceKm: null,
      ocrDistanceKm: 12.4,
    })
    expect(result.applied).toBe(true)
    expect(result.source).toBe('ocr')
    expect(result.distanceKm).toBe('12.40')
    expect(result.warnings).toHaveLength(0)
  })

  it('keeps trip distance when OCR has no distance', () => {
    const result = mergeReceiptTripDistance({
      tripDistanceKm: '10.00',
      ocrDistanceKm: null,
    })
    expect(result.applied).toBe(false)
    expect(result.distanceKm).toBe('10.00')
  })

  it('uses OCR distance as authoritative when it matches route within tolerance', () => {
    const result = mergeReceiptTripDistance({
      tripDistanceKm: '10.00',
      ocrDistanceKm: 10.03,
    })
    expect(result.applied).toBe(true)
    expect(result.source).toBe('ocr')
    expect(result.distanceKm).toBe('10.03')
    expect(result.corrected).toBe(false)
    expect(result.warnings).toHaveLength(0)
  })

  it('applies OCR distance and warns when route distance differs', () => {
    const result = mergeReceiptTripDistance({
      tripDistanceKm: '15.50',
      ocrDistanceKm: 12.25,
    })
    expect(result.applied).toBe(true)
    expect(result.corrected).toBe(true)
    expect(result.distanceKm).toBe('12.25')
    expect(result.previousDistanceKm).toBe(15.5)
    expect(result.warnings[0]?.code).toBe('distance_mismatch_trip')
  })

  it('reads route distance from trip metadata', () => {
    expect(readTripRouteDistanceKm({ routeDistanceKm: '18.75' })).toBe(18.75)
    expect(readTripRouteDistanceKm({ routeDistanceKm: 9.5 })).toBe(9.5)
    expect(readTripRouteDistanceKm({})).toBeNull()
  })
})
