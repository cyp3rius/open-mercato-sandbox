import { mapStrapiPayloadToTaxiRequest } from './strapiTaxiRequestMapper'

export const TRIP_SERVICE_TYPES = ['airport', 'local'] as const
export type TripServiceType = (typeof TRIP_SERVICE_TYPES)[number]

export const TRIP_REQUEST_PAYMENT_TYPES = ['electronic', 'cash', 'card', 'transfer', 'other'] as const
export type TripRequestPaymentType = (typeof TRIP_REQUEST_PAYMENT_TYPES)[number]

/** Payment options offered in the trip create/edit form and driver app. */
export const TRIP_FORM_PAYMENT_OPTIONS = ['electronic', 'cash', 'card', 'transfer'] as const
export type TripFormPaymentOption = (typeof TRIP_FORM_PAYMENT_OPTIONS)[number]

export const TRIP_CONTACT_TYPES = ['private', 'company'] as const
export type TripContactType = (typeof TRIP_CONTACT_TYPES)[number]

export type TripRequestDetails = {
  serviceType: TripServiceType
  fromAddress: string
  toAddress: string
  waypointAddresses: string
  distanceKm: string
  durationText: string
  passengers: string
  handLuggage: string
  holdLuggage: string
  childSeats: string
  boosterSeats: string
  isAirportPickup: boolean
  flightNumber: string
  meetAndGreet: boolean
  englishSpeakingDriver: boolean
  paymentType: TripRequestPaymentType
  contactName: string
  contactPhone: string
  contactEmail: string
  contactType: TripContactType
  companyName: string
  companyTaxId: string
  vehicleCategory: string
  basePrice: string
  referringPartnerEntityId: string
}

export type TripRequestFormSlice = TripRequestDetails

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function str(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function bool(value: unknown): boolean {
  return value === true
}

function counterString(value: unknown, fallback = '0'): string {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return String(Math.max(0, Math.trunc(parsed)))
}

function parseServiceType(value: unknown): TripServiceType {
  return str(value) === 'airport' ? 'airport' : 'local'
}

function parsePaymentType(value: unknown): TripRequestPaymentType {
  const raw = str(value)
  if (raw === 'electronic' || raw === 'paypal') return 'electronic'
  if (raw === 'cash' || raw === 'card' || raw === 'transfer' || raw === 'other') return raw
  return 'cash'
}

function parseContactType(value: unknown): TripContactType {
  return str(value) === 'company' ? 'company' : 'private'
}

export function defaultTripRequestDetails(): TripRequestDetails {
  return {
    serviceType: 'local',
    fromAddress: '',
    toAddress: '',
    waypointAddresses: '',
    distanceKm: '',
    durationText: '',
    passengers: '1',
    handLuggage: '0',
    holdLuggage: '0',
    childSeats: '0',
    boosterSeats: '0',
    isAirportPickup: false,
    flightNumber: '',
    meetAndGreet: false,
    englishSpeakingDriver: false,
    paymentType: 'cash',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    contactType: 'private',
    companyName: '',
    companyTaxId: '',
    vehicleCategory: '',
    basePrice: '',
    referringPartnerEntityId: '',
  }
}

function readTripRequestRecord(metadata: Record<string, unknown> | null): Record<string, unknown> {
  const nested = record(metadata?.tripRequest)
  if (nested) return nested
  return metadata ?? {}
}

export function tripRequestDetailsFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
  row?: { distanceKm?: string | null; revenueAmount?: string | null },
): TripRequestDetails {
  const base = defaultTripRequestDetails()
  const root = metadata ?? null
  const source = readTripRequestRecord(root)
  const strapiPayload = record(root?.strapi)
  const mapped = strapiPayload ? mapStrapiPayloadToTaxiRequest(strapiPayload) : null

  const serviceType = parseServiceType(source.serviceType ?? root?.serviceType ?? mapped?.serviceType)
  const fromAddress = str(source.fromAddress) || str(source.from) || mapped?.fromAddress || ''
  const toAddress = str(source.toAddress) || str(source.to) || mapped?.toAddress || ''
  const waypointAddresses =
    str(source.waypointAddresses) ||
    (mapped?.waypointAddresses ?? '')

  const distanceKm =
    str(source.distanceKm) ||
    (row?.distanceKm != null ? String(row.distanceKm) : '') ||
    (mapped?.distanceKm ? String(mapped.distanceKm) : '')

  return {
    serviceType,
    fromAddress,
    toAddress,
    waypointAddresses,
    distanceKm,
    durationText: str(source.durationText) || mapped?.durationText || '',
    passengers: counterString(source.passengers ?? mapped?.passengers, '1') || '1',
    handLuggage: counterString(source.handLuggage ?? mapped?.handLuggage, '0'),
    holdLuggage: counterString(source.holdLuggage ?? mapped?.holdLuggage, '0'),
    childSeats: counterString(source.childSeats ?? mapped?.childSeats, '0'),
    boosterSeats: counterString(source.boosterSeats ?? mapped?.boosterSeats, '0'),
    isAirportPickup: bool(source.isAirportPickup) || mapped?.isAirportPickup === true,
    flightNumber: str(source.flightNumber) || mapped?.flightNumber || '',
    meetAndGreet: bool(source.meetAndGreet) || mapped?.meetAndGreet === true,
    englishSpeakingDriver: bool(source.englishSpeakingDriver) || mapped?.englishSpeakingDriver === true,
    paymentType: parsePaymentType(source.paymentType ?? mapped?.paymentType),
    contactName: str(source.contactName) || mapped?.contactName || '',
    contactPhone: str(source.contactPhone) || mapped?.contactPhone || '',
    contactEmail: str(source.contactEmail) || mapped?.contactEmail || '',
    contactType: parseContactType(source.contactType ?? mapped?.contactType),
    companyName: str(source.companyName) || mapped?.companyName || '',
    companyTaxId: str(source.companyTaxId) || mapped?.companyTaxId || '',
    vehicleCategory: str(source.vehicleCategory) || mapped?.vehicleCategory || '',
    basePrice:
      str(source.basePrice) ||
      (mapped?.basePrice != null ? String(mapped.basePrice) : '') ||
      (row?.revenueAmount != null ? String(row.revenueAmount) : ''),
    referringPartnerEntityId:
      str(source.referringPartnerEntityId) ||
      str(root?.referringPartnerEntityId) ||
      '',
  }
}

export function buildTripRequestMetadata(details: TripRequestDetails): Record<string, unknown> {
  const passengers = Math.max(1, Number(details.passengers) || 1)
  const isAirport = details.serviceType === 'airport'
  return {
    tripRequest: {
      serviceType: details.serviceType,
      fromAddress: details.fromAddress.trim(),
      toAddress: details.toAddress.trim(),
      waypointAddresses: details.waypointAddresses.trim(),
      distanceKm: details.distanceKm.trim(),
      durationText: details.durationText.trim(),
      passengers,
      handLuggage: isAirport ? Math.max(0, Number(details.handLuggage) || 0) : 0,
      holdLuggage: isAirport ? Math.max(0, Number(details.holdLuggage) || 0) : 0,
      childSeats: Math.max(0, Number(details.childSeats) || 0),
      boosterSeats: Math.max(0, Number(details.boosterSeats) || 0),
      isAirportPickup: isAirport ? details.isAirportPickup : false,
      flightNumber: isAirport && details.isAirportPickup ? details.flightNumber.trim() : '',
      meetAndGreet: isAirport ? details.meetAndGreet : false,
      englishSpeakingDriver: details.englishSpeakingDriver,
      paymentType: details.paymentType,
      contactName: details.contactName.trim(),
      contactPhone: details.contactPhone.trim(),
      contactEmail: details.contactEmail.trim(),
      contactType: details.contactType,
      companyName: details.contactType === 'company' ? details.companyName.trim() : '',
      companyTaxId: details.contactType === 'company' ? details.companyTaxId.trim() : '',
      vehicleCategory: details.vehicleCategory.trim(),
      basePrice: details.basePrice.trim(),
      referringPartnerEntityId: details.referringPartnerEntityId.trim(),
    },
    serviceType: details.serviceType,
    ...(details.referringPartnerEntityId.trim()
      ? { referringPartnerEntityId: details.referringPartnerEntityId.trim() }
      : {}),
  }
}

export function parseTripRequestNumericDistance(details: TripRequestDetails): number | undefined {
  const parsed = Number(details.distanceKm)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

export function parseTripRequestRevenueAmount(details: TripRequestDetails, revenueAmount: string): number | undefined {
  const revenueRaw = revenueAmount.trim()
  if (revenueRaw.length) {
    const parsed = Number(revenueRaw)
    if (Number.isFinite(parsed)) return parsed
  }
  const baseRaw = details.basePrice.trim()
  if (baseRaw.length) {
    const parsed = Number(baseRaw)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

export function buildTripRouteNotes(details: TripRequestDetails): string | null {
  const lines = [
    details.fromAddress.trim() && details.toAddress.trim()
      ? `Trasa: ${details.fromAddress.trim()} → ${details.toAddress.trim()}`
      : null,
    details.waypointAddresses.trim() ? `Punkty pośrednie:\n${details.waypointAddresses.trim()}` : null,
    details.distanceKm.trim() ? `Dystans: ${details.distanceKm.trim()} km` : null,
    details.durationText.trim() ? `Czas: ${details.durationText.trim()}` : null,
    `Pasażerowie: ${Math.max(1, Number(details.passengers) || 1)}`,
    details.flightNumber.trim() ? `Lot: ${details.flightNumber.trim()}` : null,
    details.paymentType ? `Płatność: ${details.paymentType}` : null,
  ].filter((line): line is string => Boolean(line?.length))
  return lines.length ? lines.join('\n') : null
}
