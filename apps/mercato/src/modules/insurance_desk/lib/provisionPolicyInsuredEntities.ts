import { isValidPesel, normalizePeselDigits } from '@open-mercato/core/modules/customers/lib/pesel'
import type { MfRegistryCompanyData } from '@open-mercato/core/modules/customers/lib/mfVatRegistry'
import { isValidRegon, normalizeRegonDigits } from '@open-mercato/core/modules/customers/lib/regon'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { createCrudFormError } from '@open-mercato/ui/backend/utils/serverErrors'
import type { InsuranceLeadContact } from './insuranceLeadPayload'
import { emptyLeadUsageForm, type LeadUsageFormValue } from './leadUsageForm'

type RegistryLookupResponse = { ok: true; data: MfRegistryCompanyData | null }

async function tryFetchCompanyRegistryByRegon(regon: string): Promise<MfRegistryCompanyData | null> {
  const digits = regon.trim()
  if (!digits.length) return null
  const call = await apiCall<RegistryLookupResponse>('/api/customers/companies/registry-lookup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ regon: digits }),
  })
  if (!call.ok || !call.result || call.result.ok !== true) return null
  return call.result.data ?? null
}

const LIFECYCLE_CUSTOMER = 'customer'

function resolveInsuredSource(referringPartnerEntityId: string, sourceLeadId: string): string | undefined {
  if (referringPartnerEntityId.trim().length) return 'partner_referral'
  if (sourceLeadId.trim().length) return 'inbound_web'
  return undefined
}

function trimField(raw: string | undefined, max: number): string | undefined {
  const t = raw?.trim() ?? ''
  if (!t.length) return undefined
  return t.length > max ? t.slice(0, max) : t
}

/** Maps lead/policy contact into CustomerPersonProfile fields (not entity `description`). */
function personProfileFieldsFromContact(contact: InsuranceLeadContact): {
  pesel?: string
  residenceStreet?: string
  residencePostalCode?: string
  residenceCity?: string
  residenceCountry?: string
} {
  const out: {
    pesel?: string
    residenceStreet?: string
    residencePostalCode?: string
    residenceCity?: string
    residenceCountry?: string
  } = {}
  const digits = normalizePeselDigits(contact.pesel)
  if (digits && isValidPesel(digits)) {
    out.pesel = digits
  }
  const addr = contact.address
  if (addr) {
    const street = addr.street?.trim() ?? ''
    const num = [addr.houseNumber, addr.apartmentNumber].filter(Boolean).join('/').trim()
    const streetLine = [street, num].filter((x) => x.length > 0).join(' ').trim()
    const postal = trimField(addr.postalCode, 16)
    const city = trimField(addr.city, 120)
    const ccRaw = addr.countryCode?.trim().toUpperCase() ?? ''
    const country = ccRaw.length === 2 && /^[A-Z]{2}$/.test(ccRaw) ? ccRaw : undefined
    const streetCapped = trimField(streetLine.length ? streetLine : undefined, 500)
    if (streetCapped) out.residenceStreet = streetCapped
    if (postal) out.residencePostalCode = postal
    if (city) out.residenceCity = city
    if (country) out.residenceCountry = country
  }
  return out
}

function namesFromContact(contact: InsuranceLeadContact): { firstName: string; lastName: string } | null {
  let firstName = contact.firstName?.trim() ?? ''
  let lastName = contact.lastName?.trim() ?? ''
  if (!firstName.length || !lastName.length) {
    const full = contact.fullName?.trim() ?? ''
    if (full.length) {
      const parts = full.split(/\s+/).filter(Boolean)
      if (parts.length >= 2) {
        firstName = parts[0]!
        lastName = parts.slice(1).join(' ')
      } else {
        firstName = full
        lastName = '—'
      }
    }
  }
  if (!firstName.length || !lastName.length) return null
  return { firstName, lastName }
}

export type ProvisionPolicyInsuredParams = {
  contact: InsuranceLeadContact
  leadUsage: unknown
  referringPartnerEntityId: string
  sourceLeadId: string
  errorMessage: string
}

export type ProvisionPolicyInsuredResult = {
  personEntityId: string
  companyEntityId: string | null
}

export async function provisionPolicyInsuredEntities(
  params: ProvisionPolicyInsuredParams,
): Promise<ProvisionPolicyInsuredResult> {
  const { contact, leadUsage, referringPartnerEntityId, sourceLeadId, errorMessage } = params
  const usage: LeadUsageFormValue = {
    ...emptyLeadUsageForm(),
    ...(leadUsage && typeof leadUsage === 'object' ? (leadUsage as Record<string, unknown>) : {}),
  }
  const names = namesFromContact(contact)
  if (!names) {
    throw createCrudFormError(errorMessage, { leadContact: errorMessage })
  }
  const email = contact.email?.trim() || undefined
  const phoneRaw = contact.phone?.trim() || contact.mobile?.trim() || ''
  const phone = phoneRaw.length ? phoneRaw : undefined
  const source = resolveInsuredSource(referringPartnerEntityId, sourceLeadId)
  const personProfile = personProfileFieldsFromContact(contact)

  let companyEntityId: string | null = null
  if (usage.type === 'business') {
    const holder = contact.holderType
    const descParts: string[] = []
    let displayName = ''

    if (holder === 'civil') {
      displayName =
        (contact.partnerNames ?? '').trim() ||
        (contact.companyName ?? '').trim() ||
        'Spółka cywilna'
      const pn = (contact.partnerNames ?? '').trim()
      const pp = (contact.partnerPesels ?? '').trim()
      if (pn.length) descParts.push(`Nazwiska wspólników: ${pn}`)
      if (pp.length) descParts.push(`Pesele wspólników: ${pp}`)
    } else {
      displayName =
        (contact.companyName ?? '').trim() || `${names.firstName} ${names.lastName}`.trim()
    }

    if (!displayName.length) {
      throw createCrudFormError(errorMessage, { leadContact: errorMessage })
    }

    const regonDigits = normalizeRegonDigits(contact.regon)
    const regonPayload = regonDigits && isValidRegon(regonDigits) ? regonDigits : undefined

    const registryData = regonPayload ? await tryFetchCompanyRegistryByRegon(regonPayload) : null

    const companyBody: Record<string, unknown> = {
      displayName,
      description: descParts.length ? descParts.join('\n') : undefined,
      primaryEmail: email,
      primaryPhone: phone,
      crmRecordType: 'customer',
      status: 'active',
      lifecycleStage: LIFECYCLE_CUSTOMER,
      ...(source ? { source } : {}),
      ...(regonPayload ? { regon: regonPayload } : {}),
    }

    if (registryData) {
      if (registryData.displayName.trim().length) {
        companyBody.displayName = registryData.displayName.trim()
      }
      if (registryData.legalName.trim().length) {
        companyBody.legalName = registryData.legalName.trim()
      }
      if (registryData.nip) {
        companyBody.nip = registryData.nip
      }
      if (registryData.regon) {
        companyBody.regon = registryData.regon
      }
    }

    const companyRes = await createCrud<{ id?: string }>('customers/companies', companyBody, { errorMessage })
    companyEntityId = typeof companyRes.result?.id === 'string' ? companyRes.result.id : null
    if (!companyEntityId) {
      throw createCrudFormError(errorMessage, { leadContact: errorMessage })
    }
  }

  const displayName = `${names.firstName} ${names.lastName}`.trim()
  const personRes = await createCrud<{ id?: string }>(
    'customers/people',
    {
      firstName: names.firstName,
      lastName: names.lastName,
      displayName,
      primaryEmail: email,
      primaryPhone: phone,
      crmRecordType: 'customer',
      status: 'active',
      lifecycleStage: LIFECYCLE_CUSTOMER,
      ...(source ? { source } : {}),
      ...personProfile,
      ...(companyEntityId ? { companyEntityId } : {}),
    },
    { errorMessage },
  )
  const personEntityId = typeof personRes.result?.id === 'string' ? personRes.result.id : null
  if (!personEntityId) {
    throw createCrudFormError(errorMessage, { leadContact: errorMessage })
  }
  return { personEntityId, companyEntityId }
}
