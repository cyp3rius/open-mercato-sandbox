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
  showReceipt: boolean
}

/** Which commercial fields apply for a trip type in the driver finish form. */
export function resolveDriverCommercialFieldVisibility(
  tripType: TaxiFleetTripType,
): DriverCommercialFieldVisibility {
  // Platform trip type + platform brand are CRM / sync only — never editable in the driver app.
  switch (tripType) {
    case 'internal':
      return {
        showPlatform: false,
        showCustomer: false,
        customerRequired: false,
        showPayment: false,
        showReceipt: false,
      }
    case 'private':
    case 'empty':
      return {
        showPlatform: false,
        showCustomer: false,
        customerRequired: false,
        showPayment: false,
        showReceipt: true,
      }
    case 'street_hail':
      return {
        showPlatform: false,
        showCustomer: true,
        customerRequired: false,
        showPayment: true,
        showReceipt: true,
      }
    case 'client':
    case 'other':
      return {
        showPlatform: false,
        showCustomer: true,
        customerRequired: true,
        showPayment: true,
        showReceipt: true,
      }
    default:
      // event / platform / unknown — customer optional; platform still CRM-only
      return {
        showPlatform: false,
        showCustomer: true,
        customerRequired: false,
        showPayment: true,
        showReceipt: true,
      }
  }
}

export function tripTypeRequiresCustomer(tripType: TaxiFleetTripType): boolean {
  return resolveDriverCommercialFieldVisibility(tripType).customerRequired
}

export function tripTypeRequiresReceipt(tripType: TaxiFleetTripType): boolean {
  return resolveDriverCommercialFieldVisibility(tripType).showReceipt
}

/** Internal trips finish as pending authorization until CRM authorizes them. */
export function resolveDriverTripFinishStatus(
  tripType: string | null | undefined,
  requestedStatus: string,
): string {
  const status = String(requestedStatus ?? '').trim() || 'completed'
  if (tripType === 'internal' && status === 'completed') return 'pending_authorization'
  return status
}
