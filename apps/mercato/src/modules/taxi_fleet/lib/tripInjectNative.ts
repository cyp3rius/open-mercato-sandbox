import type { TripInjectInput } from '../data/validators'
import {
  tripInjectContactTypeSchema,
  tripInjectPaymentTypeSchema,
  tripInjectServiceTypeSchema,
} from '../data/validators'
import type { TripRequestDetails } from './tripRequestForm'
import {
  buildTripScheduleFromStrapi,
  mapStrapiPayloadToTaxiRequest,
  STRAPI_TAXI_REQUEST_SOURCE,
  type MappedStrapiTaxiRequest,
} from './strapiTaxiRequestMapper'

export function tripInjectHasDefinedCustomer(input: {
  customerPersonId?: string | null
  customerCompanyId?: string | null
  customerEntityId?: string | null
}): boolean {
  return Boolean(input.customerPersonId || input.customerCompanyId || input.customerEntityId)
}

function parsePaymentType(raw: string | null | undefined): TripInjectInput['paymentType'] {
  const parsed = tripInjectPaymentTypeSchema.safeParse(raw)
  if (parsed.success) return parsed.data
  if (raw === 'paypal' || raw === 'app') return 'electronic'
  return 'cash'
}

function parseContactType(raw: string | null | undefined): TripInjectInput['contactType'] {
  const parsed = tripInjectContactTypeSchema.safeParse(raw)
  return parsed.success ? parsed.data : 'private'
}

function parseServiceType(raw: string | null | undefined): TripInjectInput['serviceType'] {
  const parsed = tripInjectServiceTypeSchema.safeParse(raw)
  return parsed.success ? parsed.data : 'local'
}

/** Detect legacy `{ externalId, payload }` transporter envelope (no top-level route fields). */
export function isLegacyTripInjectEnvelope(body: unknown): body is {
  organizationId: string
  tenantId: string
  externalId: string
  source?: string
  payload: Record<string, unknown>
} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false
  const record = body as Record<string, unknown>
  if (!record.payload || typeof record.payload !== 'object' || Array.isArray(record.payload)) return false
  if (typeof record.fromAddress === 'string' && record.fromAddress.trim().length > 0) return false
  return typeof record.externalId === 'string' && typeof record.organizationId === 'string' && typeof record.tenantId === 'string'
}

export function toNativeTripInjectInputFromMapped(
  mapped: MappedStrapiTaxiRequest,
  params: {
    organizationId: string
    tenantId: string
    externalId: string
    source?: string
  },
): Record<string, unknown> {
  const paymentType = parsePaymentType(mapped.paymentType)
  return {
    organizationId: params.organizationId,
    tenantId: params.tenantId,
    externalId: params.externalId,
    source: params.source?.trim() || STRAPI_TAXI_REQUEST_SOURCE,
    fromAddress: mapped.fromAddress,
    toAddress: mapped.toAddress,
    waypointAddresses: mapped.waypointAddresses,
    tripDate: mapped.tripDate || undefined,
    tripTime: mapped.tripTime || undefined,
    distanceKm: mapped.distanceKm > 0 ? mapped.distanceKm : null,
    durationText: mapped.durationText,
    revenueAmount: mapped.totalPrice,
    currencyCode: 'PLN',
    paymentType,
    serviceType: parseServiceType(mapped.serviceType),
    passengers: mapped.passengers,
    handLuggage: mapped.handLuggage,
    holdLuggage: mapped.holdLuggage,
    childSeats: mapped.childSeats,
    boosterSeats: mapped.boosterSeats,
    isAirportPickup: mapped.isAirportPickup,
    flightNumber: mapped.flightNumber,
    meetAndGreet: mapped.meetAndGreet,
    englishSpeakingDriver: mapped.englishSpeakingDriver,
    vehicleCategory: mapped.vehicleCategory,
    basePrice: mapped.basePrice,
    referralCode: mapped.referralCode,
    quoteSnapshot: mapped.quoteSnapshot,
    locale: mapped.locale,
    enquiryStatus: mapped.enquiryStatus,
    contactName: mapped.contactName,
    contactPhone: mapped.contactPhone,
    contactEmail: mapped.contactEmail,
    contactType: parseContactType(mapped.contactType),
    companyName: mapped.companyName,
    companyTaxId: mapped.companyTaxId,
    transporterPayload: mapped.strapiPayload,
  }
}

export function toNativeTripInjectInputFromLegacyPayload(params: {
  organizationId: string
  tenantId: string
  externalId: string
  source?: string
  payload: Record<string, unknown>
}): Record<string, unknown> {
  const mapped = mapStrapiPayloadToTaxiRequest(params.payload)
  if (!mapped.requestId.length) {
    mapped.requestId = params.externalId
  }
  return toNativeTripInjectInputFromMapped(mapped, params)
}

export function buildTripScheduleFromInjectInput(input: TripInjectInput): { startedAt: Date; endedAt: Date } {
  if (input.startedAt) {
    const startedAt = new Date(input.startedAt)
    if (Number.isNaN(startedAt.getTime())) {
      throw new Error('INVALID_SCHEDULE')
    }
    if (input.endedAt) {
      const endedAt = new Date(input.endedAt)
      if (!Number.isNaN(endedAt.getTime()) && endedAt.getTime() > startedAt.getTime()) {
        return { startedAt, endedAt }
      }
    }
    const durationMinutes = parseDurationMinutes(input.durationText) ?? 60
    return { startedAt, endedAt: new Date(startedAt.getTime() + durationMinutes * 60 * 1000) }
  }

  return buildTripScheduleFromStrapi({
    tripDate: input.tripDate ?? '',
    tripTime: input.tripTime ?? '',
    durationText: input.durationText ?? null,
  } as MappedStrapiTaxiRequest)
}

function parseDurationMinutes(durationText: string | null | undefined): number | null {
  const match = durationText?.match(/(?:(\d+)\s*h)?\s*(\d+)\s*min/i)
  if (!match) return null
  const hours = match[1] ? Number(match[1]) : 0
  const minutes = match[2] ? Number(match[2]) : 0
  const total = hours * 60 + minutes
  return total > 0 ? Math.max(30, total) : null
}

export function tripRequestDetailsFromInjectInput(
  input: TripInjectInput,
  referringPartnerEntityId: string | null,
): TripRequestDetails {
  const serviceType = input.serviceType === 'airport' ? 'airport' : 'local'
  return {
    serviceType,
    fromAddress: input.fromAddress,
    toAddress: input.toAddress,
    waypointAddresses: input.waypointAddresses ?? '',
    distanceKm: input.distanceKm != null && input.distanceKm > 0 ? String(input.distanceKm) : '',
    durationText: input.durationText ?? '',
    passengers: String(input.passengers ?? 1),
    handLuggage: String(input.handLuggage ?? 0),
    holdLuggage: String(input.holdLuggage ?? 0),
    childSeats: String(input.childSeats ?? 0),
    boosterSeats: String(input.boosterSeats ?? 0),
    isAirportPickup: input.isAirportPickup === true,
    flightNumber: input.flightNumber ?? '',
    meetAndGreet: input.meetAndGreet === true,
    englishSpeakingDriver: input.englishSpeakingDriver === true,
    paymentType: input.paymentType ?? 'cash',
    contactName: input.contactName ?? '',
    contactPhone: input.contactPhone ?? '',
    contactEmail: input.contactEmail ?? '',
    contactType: input.contactType ?? 'private',
    companyName: input.companyName ?? '',
    companyTaxId: input.companyTaxId ?? '',
    vehicleCategory: input.vehicleCategory ?? '',
    basePrice: input.basePrice != null ? String(input.basePrice) : '',
    referringPartnerEntityId: referringPartnerEntityId ?? '',
  }
}

export function buildTripNotesFromInjectInput(input: TripInjectInput): string {
  const lines = [
    `Trasa: ${input.fromAddress} → ${input.toAddress}`,
    input.waypointAddresses?.trim() ? `Punkty pośrednie:\n${input.waypointAddresses.trim()}` : null,
    input.durationText?.trim()
      ? `Czas: ${input.durationText.trim()}`
      : null,
    input.distanceKm != null && input.distanceKm > 0 ? `Dystans: ${input.distanceKm} km` : null,
    input.passengers ? `Pasażerowie: ${input.passengers}` : null,
    input.flightNumber?.trim() ? `Lot: ${input.flightNumber.trim()}` : null,
    input.paymentType ? `Płatność: ${input.paymentType}` : null,
  ].filter((line): line is string => Boolean(line?.length))
  return lines.join('\n')
}
