import type { CoverageOptionsFormValue } from '../components/policies/PolicyCoverageOptionsField'
import { emptyLeadContactForm, type LeadContactFormValue } from './leadContactForm'
import { emptyLeadUsageForm, type LeadUsageFormValue } from './leadUsageForm'
import type { InsuranceLeadContact, InsuranceLeadPayload } from './insuranceLeadPayload'

export function leadContactFormToApi(raw: unknown): InsuranceLeadContact {
  const f = {
    ...emptyLeadContactForm(),
    ...(raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}),
  } as LeadContactFormValue
  const c: InsuranceLeadContact = {}
  if (f.holderType) c.holderType = f.holderType
  c.email = f.email.trim().length ? f.email.trim() : undefined
  c.phone = f.phone.trim().length ? f.phone.trim() : undefined
  if (f.holderType === 'private' || f.holderType === 'sole') c.personType = 'private'
  if (f.holderType === 'civil' || f.holderType === 'llc') c.personType = 'business'

  const fn = f.fullName.trim()
  if (fn.length) {
    c.fullName = fn
    const parts = fn.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      c.firstName = parts[0]
      c.lastName = parts.slice(1).join(' ')
    } else {
      c.firstName = fn
    }
  }

  if (f.companyName.trim().length) c.companyName = f.companyName.trim()
  if (f.pesel.trim().length) c.pesel = f.pesel.trim()
  if (f.regon.trim().length) c.regon = f.regon.trim()
  if (f.partnerNames.trim().length) c.partnerNames = f.partnerNames.trim()
  if (f.partnerPesels.trim().length) c.partnerPesels = f.partnerPesels.trim()
  if (f.address.trim().length) {
    c.address = { ...(c.address ?? {}), street: f.address.trim() }
  }
  return c
}

export function mergeUsageIntoCoverageOptions(
  usageRaw: unknown,
  base: CoverageOptionsFormValue,
): CoverageOptionsFormValue {
  const usage = {
    ...emptyLeadUsageForm(),
    ...(usageRaw && typeof usageRaw === 'object' ? (usageRaw as Record<string, unknown>) : {}),
  } as LeadUsageFormValue
  return {
    ...base,
    typeOfUse:
      usage.type === 'business'
        ? 'Działalność gospodarcza'
        : usage.type === 'private'
          ? 'Prywatnie'
          : '',
    financingMethod:
      usage.financing === 'leasing' ? 'Leasing' : usage.financing === 'own' ? 'Zakup własny' : '',
    leasingCompany: usage.leasingCompany,
    usingByUnder25: usage.under25 === true,
    drivingLicenseLessThan2: usage.licenseShort === true,
  }
}

export function buildLeadPayloadExtras(
  usageRaw: unknown,
  coverageSubSelections: Record<string, string>,
  coverageDetailValues: Record<string, Record<string, unknown>>,
): Pick<InsuranceLeadPayload, 'usage' | 'coverageSubSelections' | 'coverageDetailValues'> {
  const usage = {
    ...emptyLeadUsageForm(),
    ...(usageRaw && typeof usageRaw === 'object' ? (usageRaw as Record<string, unknown>) : {}),
  } as LeadUsageFormValue
  const out: Pick<InsuranceLeadPayload, 'usage' | 'coverageSubSelections' | 'coverageDetailValues'> = {}
  if (usage.type || usage.financing || usage.leasingCompany.trim() || usage.under25 !== null || usage.licenseShort !== null) {
    out.usage = {
      type: usage.type || undefined,
      financing: usage.financing || undefined,
      leasingCompany: usage.leasingCompany.trim().length ? usage.leasingCompany.trim() : undefined,
      under25: usage.under25,
      licenseShort: usage.licenseShort,
    }
  }
  if (Object.keys(coverageSubSelections).length) out.coverageSubSelections = coverageSubSelections
  if (Object.keys(coverageDetailValues).length) out.coverageDetailValues = coverageDetailValues
  return out
}
