import type { TripRequestDetails } from './tripRequestForm'

export const STRAPI_TAXI_REQUEST_SOURCE = 'rsmototaxi-strapi'

export type StrapiTaxiContactType = 'private' | 'company'

export type MappedStrapiTaxiRequest = {
  requestId: string
  enquiryStatus: string
  locale: string
  serviceType: string
  fromAddress: string
  toAddress: string
  waypointAddresses: string | null
  fromIsAirport: boolean
  toIsAirport: boolean
  distanceKm: number
  distanceText: string | null
  durationText: string | null
  tripDate: string
  tripTime: string
  passengers: number
  handLuggage: number
  holdLuggage: number
  childSeats: number
  boosterSeats: number
  isAirportPickup: boolean
  flightNumber: string | null
  meetAndGreet: boolean
  englishSpeakingDriver: boolean
  contactName: string
  contactPhone: string
  contactEmail: string
  contactType: StrapiTaxiContactType
  companyName: string | null
  companyTaxId: string | null
  vehicleCategory: string | null
  basePrice: number | null
  totalPrice: number | null
  paymentType: string | null
  referralCode: string | null
  quoteSnapshot: Record<string, unknown> | null
  strapiPayload: Record<string, unknown>
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function str(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function num(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function bool(value: unknown): boolean {
  return value === true
}

function readWaypointAddresses(payload: Record<string, unknown>): string | null {
  const direct = str(payload.waypointAddresses)
  if (direct.length) return direct
  if (!Array.isArray(payload.waypoints)) return null
  const lines = payload.waypoints
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return ''
      return str((entry as Record<string, unknown>).address)
    })
    .filter((line) => line.length > 0)
  return lines.length ? lines.join('\n') : null
}

function readQuote(payload: Record<string, unknown>) {
  const quote = record(payload.quote) ?? record(payload.quoteSnapshot)
  if (!quote) {
    return {
      vehicleCategory: str(payload.vehicleCategory) || null,
      basePrice: num(payload.basePrice),
      totalPrice: num(payload.totalPrice),
      quoteSnapshot: null,
    }
  }
  return {
    vehicleCategory: str(quote.vehicleCategory) || null,
    basePrice: num(quote.basePrice),
    totalPrice: num(quote.totalPrice),
    quoteSnapshot: quote,
  }
}

function readContact(payload: Record<string, unknown>) {
  const contact = record(payload.contact)
  const contactType: StrapiTaxiContactType =
    str(payload.contactType) === 'company' || contact?.type === 'company' ? 'company' : 'private'
  const contactName = str(payload.contactName) || str(contact?.name)
  const contactPhone = str(payload.contactPhone) || str(contact?.phone)
  const contactEmail = str(payload.contactEmail) || str(contact?.email)
  const companyName = str(payload.companyName) || str(contact?.companyName) || null
  const companyTaxId = str(payload.companyTaxId) || str(contact?.companyTaxId) || null
  return { contactType, contactName, contactPhone, contactEmail, companyName, companyTaxId }
}

export function mapStrapiPayloadToTaxiRequest(payload: Record<string, unknown>): MappedStrapiTaxiRequest {
  const fromAddress = str(payload.fromAddress) || str(payload.from)
  const toAddress = str(payload.toAddress) || str(payload.to)
  const tripDate = str(payload.tripDate) || str(payload.date)
  const tripTime = str(payload.tripTime) || str(payload.time)
  const requestId = str(payload.requestId)
  const contact = readContact(payload)
  const quote = readQuote(payload)
  const serviceType = str(payload.serviceType) || 'local'
  const isAirport = serviceType === 'airport'

  return {
    requestId,
    enquiryStatus: str(payload.enquiryStatus) || 'new',
    locale: str(payload.locale) || 'pl',
    serviceType,
    fromAddress,
    toAddress,
    waypointAddresses: readWaypointAddresses(payload),
    fromIsAirport: bool(payload.fromIsAirport),
    toIsAirport: bool(payload.toIsAirport),
    distanceKm: num(payload.distanceKm) ?? 0,
    distanceText: str(payload.distanceText) || null,
    durationText: str(payload.durationText) || null,
    tripDate,
    tripTime,
    passengers: Math.max(1, num(payload.passengers) ?? 1),
    handLuggage: isAirport ? Math.max(0, num(payload.handLuggage) ?? 0) : 0,
    holdLuggage: isAirport ? Math.max(0, num(payload.holdLuggage) ?? 0) : 0,
    childSeats: Math.max(0, num(payload.childSeats) ?? 0),
    boosterSeats: Math.max(0, num(payload.boosterSeats) ?? 0),
    isAirportPickup: isAirport ? bool(payload.isAirportPickup) : false,
    flightNumber: isAirport && bool(payload.isAirportPickup) ? str(payload.flightNumber) || null : null,
    meetAndGreet: isAirport ? bool(payload.meetAndGreet) : false,
    englishSpeakingDriver: bool(payload.englishSpeakingDriver),
    contactName: contact.contactName,
    contactPhone: contact.contactPhone,
    contactEmail: contact.contactEmail,
    contactType: contact.contactType,
    companyName: contact.companyName,
    companyTaxId: contact.companyTaxId,
    vehicleCategory: quote.vehicleCategory,
    basePrice: quote.basePrice,
    totalPrice: quote.totalPrice,
    paymentType: str(payload.paymentType) || null,
    referralCode: str(payload.referralCode) || null,
    quoteSnapshot: quote.quoteSnapshot,
    strapiPayload: payload,
  }
}

export function buildTripScheduleFromStrapi(mapped: MappedStrapiTaxiRequest): { startedAt: Date; endedAt: Date } {
  const startedAt = new Date(`${mapped.tripDate}T${mapped.tripTime}:00`)
  if (Number.isNaN(startedAt.getTime())) {
    throw new Error('INVALID_SCHEDULE')
  }
  const durationMinutes = (() => {
    const match = mapped.durationText?.match(/(?:(\d+)\s*h)?\s*(\d+)\s*min/i)
    if (match) {
      const hours = match[1] ? Number(match[1]) : 0
      const minutes = match[2] ? Number(match[2]) : 0
      const total = hours * 60 + minutes
      if (total > 0) return Math.max(30, total)
    }
    return 60
  })()
  const endedAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000)
  return { startedAt, endedAt }
}

export function tripRequestDetailsFromStrapiMapped(
  mapped: MappedStrapiTaxiRequest,
  referringPartnerEntityId: string | null,
): TripRequestDetails {
  const paymentType =
    mapped.paymentType === 'cash' ||
    mapped.paymentType === 'card' ||
    mapped.paymentType === 'transfer' ||
    mapped.paymentType === 'loyalty_program' ||
    mapped.paymentType === 'other'
      ? mapped.paymentType
      : 'electronic'

  return {
    serviceType: mapped.serviceType === 'airport' ? 'airport' : 'local',
    fromAddress: mapped.fromAddress,
    toAddress: mapped.toAddress,
    waypointAddresses: mapped.waypointAddresses ?? '',
    distanceKm: mapped.distanceKm > 0 ? String(mapped.distanceKm) : '',
    durationText: mapped.durationText ?? '',
    passengers: String(mapped.passengers),
    handLuggage: String(mapped.handLuggage),
    holdLuggage: String(mapped.holdLuggage),
    childSeats: String(mapped.childSeats),
    boosterSeats: String(mapped.boosterSeats),
    isAirportPickup: mapped.isAirportPickup,
    flightNumber: mapped.flightNumber ?? '',
    meetAndGreet: mapped.meetAndGreet,
    englishSpeakingDriver: mapped.englishSpeakingDriver,
    contactName: mapped.contactName,
    contactPhone: mapped.contactPhone,
    contactEmail: mapped.contactEmail,
    contactType: mapped.contactType,
    companyName: mapped.companyName ?? '',
    companyTaxId: mapped.companyTaxId ?? '',
    vehicleCategory: mapped.vehicleCategory ?? '',
    basePrice: mapped.basePrice != null ? String(mapped.basePrice) : '',
    referringPartnerEntityId: referringPartnerEntityId ?? '',
    paymentType,
  }
}

export function buildTripNotesFromStrapi(mapped: MappedStrapiTaxiRequest): string {
  const lines = [
    `Trasa: ${mapped.fromAddress} → ${mapped.toAddress}`,
    mapped.waypointAddresses ? `Punkty pośrednie:\n${mapped.waypointAddresses}` : null,
    mapped.distanceText ? `Dystans: ${mapped.distanceText}` : mapped.distanceKm ? `Dystans: ${mapped.distanceKm} km` : null,
    mapped.durationText ? `Czas: ${mapped.durationText}` : null,
    mapped.passengers ? `Pasażerowie: ${mapped.passengers}` : null,
    mapped.flightNumber ? `Lot: ${mapped.flightNumber}` : null,
    mapped.paymentType ? `Płatność: ${mapped.paymentType}` : null,
  ].filter((line): line is string => Boolean(line?.length))
  return lines.join('\n')
}

export function deriveInjectTripTitle(mapped: MappedStrapiTaxiRequest, fallback: string): string {
  if (mapped.fromAddress && mapped.toAddress) {
    return `${mapped.fromAddress} → ${mapped.toAddress}`
  }
  if (mapped.contactName.length) return mapped.contactName
  return fallback
}
