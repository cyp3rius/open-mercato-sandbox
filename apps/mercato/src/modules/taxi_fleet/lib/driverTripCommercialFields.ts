import type { TaxiFleetTripType } from '../components/useTaxiFleetLabels'

/** Trip types shown in the driver commercial picker (not event / platform sync). */
export const DRIVER_COMMERCIAL_TRIP_TYPES = [
  'client',
  'street_hail',
  'internal',
  'private',
  'empty',
  'other',
] as const satisfies readonly TaxiFleetTripType[]

export type DriverCommercialTripType = (typeof DRIVER_COMMERCIAL_TRIP_TYPES)[number]

export type DriverCommercialFieldVisibility = {
  showPlatform: boolean
  showCustomer: boolean
  customerRequired: boolean
  showPayment: boolean
}

/** Which commercial fields apply for a trip type in the driver finish form. */
export function resolveDriverCommercialFieldVisibility(
  tripType: TaxiFleetTripType,
): DriverCommercialFieldVisibility {
  switch (tripType) {
    case 'private':
    case 'internal':
    case 'empty':
      return {
        showPlatform: false,
        showCustomer: false,
        customerRequired: false,
        showPayment: false,
      }
    case 'street_hail':
      return {
        showPlatform: false,
        showCustomer: true,
        customerRequired: false,
        showPayment: true,
      }
    case 'client':
    case 'other':
      return {
        showPlatform: true,
        showCustomer: true,
        customerRequired: true,
        showPayment: true,
      }
    default:
      // event / platform / unknown — keep full fields for operator/legacy edits
      return {
        showPlatform: true,
        showCustomer: true,
        customerRequired: false,
        showPayment: true,
      }
  }
}

export function tripTypeRequiresCustomer(tripType: TaxiFleetTripType): boolean {
  return resolveDriverCommercialFieldVisibility(tripType).customerRequired
}
