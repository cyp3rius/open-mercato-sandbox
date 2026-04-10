import { emptyPolicyCoveragesValue } from '../components/policies/PolicyCoveragesField'
import { emptyCoverageOptionsValue, type CoverageOptionsFormValue } from '../components/policies/PolicyCoverageOptionsField'
import { emptyVehicleFields, vehicleFromSubjectJson } from '../components/policies/PolicySubjectField'
import type { InsuranceLeadPayload } from './insuranceLeadPayload'
import { emptyLeadContactForm, type LeadContactFormValue } from './leadContactForm'
import { emptyLeadUsageForm, type LeadUsageFormValue } from './leadUsageForm'

function mergeCoverageOptionsPayload(raw: unknown): CoverageOptionsFormValue {
  const base = emptyCoverageOptionsValue()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  for (const key of Object.keys(base) as (keyof CoverageOptionsFormValue)[]) {
    const v = o[key]
    if (typeof base[key] === 'boolean') {
      ;(base as Record<string, unknown>)[key] = Boolean(v)
    } else if (typeof base[key] === 'string') {
      ;(base as Record<string, unknown>)[key] = typeof v === 'string' ? v : ''
    }
  }
  return base
}

function contactToLeadForm(contact: InsuranceLeadPayload['contact']): LeadContactFormValue {
  const base = emptyLeadContactForm()
  const c = contact ?? {}
  if (c.holderType === 'private' || c.holderType === 'sole' || c.holderType === 'civil' || c.holderType === 'llc') {
    base.holderType = c.holderType
  } else if (c.personType === 'business') {
    base.holderType = c.companyName ? 'llc' : 'sole'
  } else {
    base.holderType = 'private'
  }

  if (typeof c.fullName === 'string' && c.fullName.trim().length) {
    base.fullName = c.fullName.trim()
  } else {
    const fn = typeof c.firstName === 'string' ? c.firstName.trim() : ''
    const ln = typeof c.lastName === 'string' ? c.lastName.trim() : ''
    base.fullName = [fn, ln].filter(Boolean).join(' ')
  }

  base.pesel = typeof c.pesel === 'string' ? c.pesel : ''
  base.regon = typeof c.regon === 'string' ? c.regon : ''
  base.companyName = typeof c.companyName === 'string' ? c.companyName : ''
  base.partnerNames = typeof c.partnerNames === 'string' ? c.partnerNames : ''
  base.partnerPesels = typeof c.partnerPesels === 'string' ? c.partnerPesels : ''
  base.phone = typeof c.phone === 'string' ? c.phone : ''
  base.email = typeof c.email === 'string' ? c.email : ''

  const addr = c.address
  if (typeof addr?.street === 'string' && addr.street.trim().length) {
    base.address = addr.street.trim()
  }
  return base
}

function usageFromPayload(
  p: InsuranceLeadPayload,
  coverageOpt: CoverageOptionsFormValue,
): LeadUsageFormValue {
  const base = emptyLeadUsageForm()
  const u = p.usage
  if (u?.type === 'private' || u?.type === 'business') base.type = u.type
  if (u?.financing === 'leasing' || u?.financing === 'own') base.financing = u.financing
  if (typeof u?.leasingCompany === 'string') base.leasingCompany = u.leasingCompany
  if (u?.under25 === true || u?.under25 === false) base.under25 = u.under25
  if (u?.under25 === null) base.under25 = null
  if (u?.licenseShort === true || u?.licenseShort === false) base.licenseShort = u.licenseShort
  if (u?.licenseShort === null) base.licenseShort = null

  if (!base.type && coverageOpt.typeOfUse === 'Działalność gospodarcza') base.type = 'business'
  if (!base.type && coverageOpt.typeOfUse === 'Prywatnie') base.type = 'private'
  if (!base.financing && coverageOpt.financingMethod === 'Leasing') base.financing = 'leasing'
  if (!base.financing && coverageOpt.financingMethod === 'Zakup własny') base.financing = 'own'
  if (!base.leasingCompany.trim().length && coverageOpt.leasingCompany.trim().length) {
    base.leasingCompany = coverageOpt.leasingCompany
  }
  if (base.under25 === null && typeof coverageOpt.usingByUnder25 === 'boolean') base.under25 = coverageOpt.usingByUnder25
  if (base.licenseShort === null && typeof coverageOpt.drivingLicenseLessThan2 === 'boolean') {
    base.licenseShort = coverageOpt.drivingLicenseLessThan2
  }

  return base
}

/**
 * Maps API lead `payload` + top-level CRM partner id into CrudForm initial values for lead create/detail forms.
 */
export function buildLeadFormValuesFromPayload(
  referringPartnerEntityIdTop: string | null | undefined,
  payload: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const p = (payload ?? {}) as InsuranceLeadPayload
  const contact = p.contact ?? {}
  const partner =
    (typeof p.referringPartnerEntityId === 'string' && p.referringPartnerEntityId.length
      ? p.referringPartnerEntityId
      : referringPartnerEntityIdTop) ?? ''

  const subj = p.subject
  const vehicleJson =
    subj && typeof subj === 'object' && subj !== null && 'vehicle' in subj
      ? (subj as { vehicle?: unknown }).vehicle
      : undefined

  const coveragesPref: ReturnType<typeof emptyPolicyCoveragesValue> =
    p.coverages && typeof p.coverages === 'object'
      ? (p.coverages as ReturnType<typeof emptyPolicyCoveragesValue>)
      : emptyPolicyCoveragesValue()

  const coverageOptPref = mergeCoverageOptionsPayload(p.coverageOptions)
  const leadUsage = usageFromPayload(p, coverageOptPref)

  const subs =
    p.coverageSubSelections && typeof p.coverageSubSelections === 'object'
      ? (p.coverageSubSelections as Record<string, string>)
      : {}
  const details =
    p.coverageDetailValues && typeof p.coverageDetailValues === 'object'
      ? (p.coverageDetailValues as Record<string, Record<string, unknown>>)
      : {}

  return {
    referringPartnerEntityId: partner,
    leadContact: contactToLeadForm(contact),
    leadUsage,
    coverages: coveragesPref,
    coverageSubSelections: subs,
    coverageDetailValues: details,
    coverageOptions: coverageOptPref,
    leadVehicle: vehicleJson ? vehicleFromSubjectJson(vehicleJson) : emptyVehicleFields(),
    notes: typeof p.notes === 'string' ? p.notes : '',
  }
}
