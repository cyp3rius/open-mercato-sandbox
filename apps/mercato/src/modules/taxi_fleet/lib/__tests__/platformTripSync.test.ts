import { buildPlatformTripMetadata, resolvePlatformTripPaymentType } from '../platformSync/platformTripMetadata'
import { platformDriverProfileField } from '../platformSync/types'
import { readTripPaymentType } from '../settlementRevenue'
import { tripCreateSchema } from '../../data/validators'

describe('platformTrip sync helpers', () => {
  describe('platformDriverProfileField', () => {
    it('maps platforms to profile columns', () => {
      expect(platformDriverProfileField('bolt')).toBe('boltDriverId')
      expect(platformDriverProfileField('uber')).toBe('uberDriverId')
      expect(platformDriverProfileField('free')).toBe('freeDriverId')
    })
  })

  describe('buildPlatformTripMetadata', () => {
    it('stores payment type under tripRequest for settlement classifier', () => {
      const metadata = buildPlatformTripMetadata({
        ingestSource: 'platform_sync',
        platformDriverId: 'driver-42',
        paymentType: 'cash',
        rawExternalStatus: 'completed',
      })
      expect(metadata.ingestSource).toBe('platform_sync')
      expect(metadata.platformDriverId).toBe('driver-42')
      expect(readTripPaymentType(metadata)).toBe('cash')
    })

    it('defaults payment type to electronic', () => {
      expect(resolvePlatformTripPaymentType(null)).toBe('electronic')
      const metadata = buildPlatformTripMetadata({
        ingestSource: 'platform_csv',
        platformDriverId: 'driver-1',
      })
      expect(readTripPaymentType(metadata)).toBe('electronic')
    })
  })

  describe('tripCreateSchema customer rules unchanged', () => {
    it('still requires customer for manual client trips', () => {
      const result = tripCreateSchema.safeParse({
        tenantId: '00000000-0000-4000-8000-000000000001',
        organizationId: '00000000-0000-4000-8000-000000000002',
        teamMemberId: '00000000-0000-4000-8000-000000000003',
        tripType: 'client',
        status: 'completed',
        revenueAmount: 100,
      })
      expect(result.success).toBe(false)
    })

    it('allows other trip type without customer', () => {
      const result = tripCreateSchema.safeParse({
        tenantId: '00000000-0000-4000-8000-000000000001',
        organizationId: '00000000-0000-4000-8000-000000000002',
        teamMemberId: '00000000-0000-4000-8000-000000000003',
        resourceId: '00000000-0000-4000-8000-000000000004',
        tripType: 'other',
        platform: 'bolt',
        status: 'completed',
        revenueAmount: 100,
      })
      expect(result.success).toBe(true)
    })
  })
})
