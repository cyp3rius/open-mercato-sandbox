import type { InsuranceLeadContact, InsuranceLeadPayload } from '../../insurance_desk/lib/insuranceLeadPayload'
import {
  mapStrapiPayloadToInsuranceLead,
  normalizeStrapiReferralCode,
  type MappedStrapiLead,
} from '../../insurance_desk/lib/strapiLeadMapper'

export const STRAPI_DEAL_SOURCE = 'rsmotoconcierge-strapi'

export type MappedStrapiDeal = MappedStrapiLead

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function str(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function splitFullName(fullName: string): { firstName: string; lastName: string; displayName: string } {
  const collapsed = fullName.trim().replace(/\s+/g, ' ')
  if (!collapsed.length) {
    return { firstName: 'Kontakt', lastName: 'Strapi', displayName: 'Kontakt Strapi' }
  }
  const parts = collapsed.split(' ').filter(Boolean)
  if (parts.length >= 2) {
    return {
      firstName: parts[0]!,
      lastName: parts.slice(1).join(' '),
      displayName: collapsed,
    }
  }
  return { firstName: collapsed, lastName: collapsed, displayName: collapsed }
}

export function isStrapiCooperationPayload(strapiPayload: Record<string, unknown>): boolean {
  if (record(strapiPayload.stepOne) || record(strapiPayload.stepFinal)) return false
  const fullname = str(strapiPayload.fullname) || str(strapiPayload.fullName)
  const email = str(strapiPayload.email)
  const message = str(strapiPayload.message)
  return fullname.length > 0 || email.length > 0 || message.length > 0
}

export function mapStrapiCooperationPayloadToDeal(strapiPayload: Record<string, unknown>): MappedStrapiDeal {
  const fullname = str(strapiPayload.fullname) || str(strapiPayload.fullName)
  const email = str(strapiPayload.email)
  const phone = str(strapiPayload.phone)
  const vehicleRaw = str(strapiPayload.vehicle)
  const message = str(strapiPayload.message)
  const consent = strapiPayload.consent === true

  const referral = record(strapiPayload.referralCode)
  const referralCodeRaw = referral ? str(referral.code) : ''
  const referralOwnerName = referral ? str(referral.owner) : ''
  const referralCode = referralCodeRaw.length ? normalizeStrapiReferralCode(referralCodeRaw) : null

  const contact: InsuranceLeadContact = {
    ...(fullname.length ? { fullName: fullname } : {}),
    ...(email.length ? { email } : {}),
    ...(phone.length ? { phone } : {}),
  }

  const vehicle = vehicleRaw.length ? { brandAndModel: vehicleRaw } : undefined
  const payload: InsuranceLeadPayload = {
    resourceKind: 'external',
    formKind: 'cooperation',
    ...(vehicle ? { subject: { vehicle } } : {}),
    contact,
    strapi: strapiPayload,
    cooperation: {
      vehicle: vehicleRaw || undefined,
      message: message || undefined,
      consent,
      strapiDocumentId: str(strapiPayload.strapiDocumentId) || undefined,
      createdAt: str(strapiPayload.createdAt) || undefined,
    },
  }
  const strapiDocumentId = str(strapiPayload.strapiDocumentId)
  if (strapiDocumentId.length) payload.strapiDocumentId = strapiDocumentId

  return {
    payload,
    referralCode,
    referralOwnerName: referralOwnerName.length ? referralOwnerName : null,
  }
}

export function mapStrapiPayloadForDealInject(strapiPayload: Record<string, unknown>): MappedStrapiDeal {
  if (isStrapiCooperationPayload(strapiPayload)) {
    return mapStrapiCooperationPayloadToDeal(strapiPayload)
  }
  return mapStrapiPayloadToInsuranceLead(strapiPayload)
}

export function deriveDealTitle(fallbackTitle: string, payload: InsuranceLeadPayload): string {
  const title = fallbackTitle.trim()
  if (title.length) return title
  const cooperation = record(payload.cooperation)
  const cooperationVehicle = cooperation ? str(cooperation.vehicle) : ''
  if (cooperationVehicle.length) return cooperationVehicle
  const vehicle = payload.subject?.vehicle
  if (vehicle && typeof vehicle === 'object') {
    const brand = str((vehicle as Record<string, unknown>).brandAndModel)
    const plate = str((vehicle as Record<string, unknown>).plateNumber)
    if (brand && plate) return `${brand} · ${plate}`
    if (brand.length) return brand
    if (plate.length) return plate
  }
  const contactName = str(payload.contact?.fullName)
  if (contactName.length) return contactName
  return 'Zapytanie Strapi'
}

function contactDisplayName(contact: InsuranceLeadContact | undefined): string {
  const c = contact ?? {}
  return str(c.fullName) || [str(c.firstName), str(c.lastName)].filter(Boolean).join(' ')
}

function vehicleTextFromPayload(payload: InsuranceLeadPayload): string {
  const cooperation = record(payload.cooperation)
  const fromCooperation = cooperation ? str(cooperation.vehicle) : ''
  if (fromCooperation.length) return fromCooperation
  const vehicle = payload.subject?.vehicle
  if (vehicle && typeof vehicle === 'object') {
    return str((vehicle as Record<string, unknown>).brandAndModel)
  }
  return ''
}

function appendMessageBlock(lines: string[], message: string): void {
  const text = message.trim()
  if (!text.length) return
  if (lines.length) lines.push('')
  lines.push('Wiadomość:', text)
}

export function buildDealDescription(payload: InsuranceLeadPayload): string | null {
  const cooperation = record(payload.cooperation)
  const contact = payload.contact ?? {}
  const isCooperation = payload.formKind === 'cooperation' || cooperation !== null

  if (isCooperation) {
    const lines: string[] = []
    const fullName = contactDisplayName(contact)
    const vehicleText = vehicleTextFromPayload(payload)
    const phone = str(contact.phone)
    const email = str(contact.email)
    const message = cooperation ? str(cooperation.message) : ''

    if (fullName.length) lines.push(`Imię i nazwisko: ${fullName}`)
    if (vehicleText.length) lines.push(`Pojazd: ${vehicleText}`)
    if (phone.length) lines.push(`Telefon: ${phone}`)
    if (email.length) lines.push(`E-mail: ${email}`)
    appendMessageBlock(lines, message)
    return lines.length ? lines.join('\n') : null
  }

  const lines: string[] = []
  const fullName = contactDisplayName(contact)
  if (fullName.length) lines.push(`Imię i nazwisko: ${fullName}`)

  const vehicle = payload.subject?.vehicle
  if (vehicle && typeof vehicle === 'object') {
    const v = vehicle as Record<string, unknown>
    const brand = str(v.brandAndModel)
    const plate = str(v.plateNumber)
    const vin = str(v.vinNumber)
    if (brand.length) lines.push(`Pojazd: ${brand}`)
    if (plate.length) lines.push(`Rejestracja: ${plate}`)
    if (vin.length) lines.push(`VIN: ${vin}`)
  }

  const phone = str(contact.phone)
  if (phone.length) lines.push(`Telefon: ${phone}`)
  const email = str(contact.email)
  if (email.length) lines.push(`E-mail: ${email}`)

  const notes = str(contact.notes) || str(payload.notes)
  appendMessageBlock(lines, notes)
  return lines.length ? lines.join('\n') : null
}

export function mapContactToPersonFields(
  contact: InsuranceLeadContact | undefined,
  source: string,
): {
  firstName: string
  lastName: string
  displayName: string
  primaryEmail?: string
  primaryPhone?: string
  pesel?: string | null
  source: string
} | null {
  const c = contact ?? {}
  const fullNameRaw =
    str(c.fullName) || [str(c.firstName), str(c.lastName)].filter(Boolean).join(' ')
  const email = str(c.email)
  const phone = str(c.phone)
  if (!fullNameRaw.length && !email.length && !phone.length) return null
  const name = fullNameRaw.length ? splitFullName(fullNameRaw) : { firstName: 'Kontakt', lastName: 'Strapi', displayName: email || phone || 'Kontakt Strapi' }
  return {
    firstName: name.firstName,
    lastName: name.lastName,
    displayName: name.displayName,
    ...(email.length ? { primaryEmail: email } : {}),
    ...(phone.length ? { primaryPhone: phone } : {}),
    ...(str(c.pesel).length ? { pesel: str(c.pesel) } : {}),
    source,
  }
}

export function buildDealPayloadForStorage(mappedPayload: InsuranceLeadPayload): Record<string, unknown> {
  return { ...mappedPayload }
}
