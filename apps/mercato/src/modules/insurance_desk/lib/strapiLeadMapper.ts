import type { InsuranceLeadContact, InsuranceLeadPayload } from './insuranceLeadPayload'

export const STRAPI_LEAD_SOURCE = 'rsmotoconcierge-strapi'

const POLICY_COVERAGE_KEYS = [
  'OC',
  'AC',
  'NNW',
  'ASSISTANCE',
  'GLASS',
  'DISCOUNT',
  'FOIL',
  'THEFT',
  'GREEN_CARD',
] as const

type PolicyCoverageKey = (typeof POLICY_COVERAGE_KEYS)[number]

type PolicyCoverageLine = {
  enabled: boolean
  sumInsured: string
  deductible: string
  notes: string
}

function emptyPolicyCoveragesValue(): Record<PolicyCoverageKey, PolicyCoverageLine> {
  const line = (): PolicyCoverageLine => ({
    enabled: false,
    sumInsured: '',
    deductible: '',
    notes: '',
  })
  return Object.fromEntries(POLICY_COVERAGE_KEYS.map((key) => [key, line()])) as Record<
    PolicyCoverageKey,
    PolicyCoverageLine
  >
}

const COVERAGE_TITLE_MAP: Record<string, PolicyCoverageKey> = {
  oc: 'OC',
  ac: 'AC',
  assistance: 'ASSISTANCE',
  nnw: 'NNW',
  szyby: 'GLASS',
  'ochrona szyb': 'GLASS',
  'ochrona zniżek': 'DISCOUNT',
  'ochrona znizek': 'DISCOUNT',
  'ubezpieczenie folii': 'FOIL',
  folia: 'FOIL',
  kradzież: 'THEFT',
  theft: 'THEFT',
  'zielona karta': 'GREEN_CARD',
  'green card': 'GREEN_CARD',
}

const HOLDER_TYPE_BY_ENTITY: Record<string, InsuranceLeadContact['holderType']> = {
  'osoba prywatna': 'private',
  'jednoosobowa działalność': 'sole',
  'jednoosobowa dzialalnosc': 'sole',
  'spółka cywilna': 'civil',
  'spolka cywilna': 'civil',
  'spółka z o.o.': 'llc',
  'spolka z o.o.': 'llc',
  'spółka z ograniczoną odpowiedzialnością': 'llc',
}

export function normalizeStrapiReferralCode(raw: string): string | null {
  const alphanumeric = raw.trim().replace(/[^a-zA-Z0-9]/g, '')
  if (alphanumeric.length < 3 || alphanumeric.length > 64) return null
  return alphanumeric
}

function str(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return String(value)
  return ''
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function coverageKeyFromTitle(title: string): PolicyCoverageKey | null {
  const normalized = title.trim().toLowerCase()
  if (!normalized.length) return null
  const mapped = COVERAGE_TITLE_MAP[normalized]
  if (mapped) return mapped
  for (const key of POLICY_COVERAGE_KEYS) {
    if (key.toLowerCase() === normalized) return key
  }
  return null
}

function mapCoveragesFromSelections(selections: unknown): ReturnType<typeof emptyPolicyCoveragesValue> {
  const coverages = emptyPolicyCoveragesValue()
  if (!Array.isArray(selections)) return coverages
  for (const item of selections) {
    const row = record(item)
    if (!row) continue
    const key = coverageKeyFromTitle(str(row.title))
    if (!key) continue
    coverages[key] = {
      enabled: true,
      sumInsured: '',
      deductible: '',
      notes: str(row.description) || str(row.note),
    }
  }
  return coverages
}

function emptyCoverageOptionsValue() {
  return {
    claimAssessment: '',
    financingMethod: '',
    typeOfUse: '',
    leasingCompany: '',
    deductible: false,
    deductibleAmount: '',
    fixedInsuranceSum: false,
    insuredValueBasis: '',
    partsDepreciation: false,
    partsType: '',
    sumConsumption: false,
    territorialScope: '',
    towingLimit: '',
    vehicleEquipment: '',
    drivingLicenseLessThan2: false,
    usingByUnder25: false,
    isCompany: false,
    isFundedOwn: false,
  }
}

function mapHolderType(stepFinal: Record<string, unknown>, stepFour: Record<string, unknown> | null): InsuranceLeadContact['holderType'] {
  const entityType = str(stepFinal.entityType).toLowerCase()
  const mapped = HOLDER_TYPE_BY_ENTITY[entityType]
  if (mapped) return mapped
  if (stepFour?.isCompany === true) return 'llc'
  return 'private'
}

function splitFullName(fullName: string): { firstName?: string; lastName?: string; fullName: string } {
  const collapsed = fullName.trim().replace(/\s+/g, ' ')
  if (!collapsed.length) return { fullName: '' }
  const parts = collapsed.split(' ')
  if (parts.length >= 2) {
    return {
      fullName: collapsed,
      firstName: parts[0],
      lastName: parts.slice(1).join(' '),
    }
  }
  return { fullName: collapsed, firstName: collapsed }
}

function mapContact(stepFinal: Record<string, unknown>, stepFour: Record<string, unknown> | null): InsuranceLeadContact {
  const holderType = mapHolderType(stepFinal, stepFour)
  const fullNameRaw = str(stepFinal.fullname) || str(stepFinal.fullName)
  const nameParts = splitFullName(fullNameRaw)
  const contact: InsuranceLeadContact = {
    holderType,
    fullName: nameParts.fullName || undefined,
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    email: str(stepFinal.email) || undefined,
    phone: str(stepFinal.phone) || undefined,
    pesel: str(stepFinal.pesel) || undefined,
    regon: str(stepFinal.regon) || undefined,
    partnerNames: str(stepFinal.peselMultiple) || undefined,
  }
  if (holderType === 'private' || holderType === 'sole') contact.personType = 'private'
  if (holderType === 'civil' || holderType === 'llc') contact.personType = 'business'
  const addressRaw = str(stepFinal.address)
  if (addressRaw.length) contact.address = { street: addressRaw }
  const notes = str(stepFinal.additionalInfo)
  if (notes.length) contact.notes = notes
  return contact
}

function mapCoverageOptions(stepTwo: Record<string, unknown> | null, stepFour: Record<string, unknown> | null) {
  const options = emptyCoverageOptionsValue()
  if (stepTwo) {
    options.typeOfUse = str(stepTwo.typeOfUse)
    options.financingMethod = str(stepTwo.financingMethod)
    options.leasingCompany = str(stepTwo.leasingCompany)
    options.usingByUnder25 = stepTwo.usingByUnder25 === true
    options.drivingLicenseLessThan2 = stepTwo.drivingLicenseLessThan2 === true
  }
  if (stepFour) {
    options.fixedInsuranceSum = stepFour.fixedInsuranceSum === true
    options.insuredValueBasis = str(stepFour.insuredValueBasis)
    options.vehicleEquipment = str(stepFour.vehicleEquipment)
    options.territorialScope = str(stepFour.territorialScope)
    options.towingLimit = str(stepFour.towingLimit)
    options.claimAssessment = str(stepFour.claimAssessment)
    options.partsType = str(stepFour.partsType)
    options.partsDepreciation = stepFour.partsDepreciation === true
    options.deductible = stepFour.deductible === true
    options.sumConsumption = stepFour.sumConsumption === true
    options.isCompany = stepFour.isCompany === true
    options.isFundedOwn = stepFour.isFundedOwn === true
    options.deductibleAmount = str(stepFour.deductibleAmount)
  }
  return options
}

function mapUsage(stepTwo: Record<string, unknown> | null) {
  if (!stepTwo) return undefined
  const typeOfUse = str(stepTwo.typeOfUse).toLowerCase()
  const financingMethod = str(stepTwo.financingMethod).toLowerCase()
  const usage: NonNullable<InsuranceLeadPayload['usage']> = {}
  if (typeOfUse.includes('gospodarcza') || typeOfUse.includes('business')) usage.type = 'business'
  if (typeOfUse.includes('prywat') || typeOfUse.includes('private')) usage.type = 'private'
  if (financingMethod.includes('leasing')) usage.financing = 'leasing'
  if (financingMethod.includes('własn') || financingMethod.includes('wlasn') || financingMethod.includes('own')) {
    usage.financing = 'own'
  }
  const leasingCompany = str(stepTwo.leasingCompany)
  if (leasingCompany.length) usage.leasingCompany = leasingCompany
  if (stepTwo.usingByUnder25 === true || stepTwo.usingByUnder25 === false) usage.under25 = stepTwo.usingByUnder25
  if (stepTwo.drivingLicenseLessThan2 === true || stepTwo.drivingLicenseLessThan2 === false) {
    usage.licenseShort = stepTwo.drivingLicenseLessThan2
  }
  return Object.keys(usage).length ? usage : undefined
}

function mapVehicle(stepOne: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!stepOne) return null
  const vehicle: Record<string, unknown> = {}
  const brandAndModel = str(stepOne.brandAndModel)
  const plateNumber = str(stepOne.plateNumber)
  const vinNumber = str(stepOne.vinNumber)
  const registrationDate = str(stepOne.registrationDate).slice(0, 10)
  const yearRaw = stepOne.yearOfManufacture
  const milageRaw = stepOne.milage ?? stepOne.mileage
  if (brandAndModel.length) vehicle.brandAndModel = brandAndModel
  if (plateNumber.length) vehicle.plateNumber = plateNumber
  if (vinNumber.length) vehicle.vinNumber = vinNumber
  if (registrationDate.length) vehicle.registrationDate = registrationDate
  if (typeof yearRaw === 'number' && Number.isFinite(yearRaw)) vehicle.yearOfManufacture = yearRaw
  else if (str(yearRaw).length) vehicle.yearOfManufacture = str(yearRaw)
  if (typeof milageRaw === 'number' && Number.isFinite(milageRaw)) vehicle.milage = milageRaw
  else if (str(milageRaw).length) vehicle.milage = str(milageRaw)
  return Object.keys(vehicle).length ? vehicle : null
}

function collectStrapiFileRefs(strapiPayload: Record<string, unknown>): Array<{ name?: string; url?: string; mimeType?: string }> {
  const out: Array<{ name?: string; url?: string; mimeType?: string }> = []
  const push = (item: unknown) => {
    if (!item || typeof item !== 'object') return
    const row = item as Record<string, unknown>
    const url =
      (typeof row.url === 'string' && row.url.trim().length ? row.url.trim() : null) ??
      (typeof row.sourceUrl === 'string' && row.sourceUrl.trim().length ? row.sourceUrl.trim() : null)
    if (!url) return
    const name =
      (typeof row.name === 'string' && row.name.trim().length ? row.name.trim() : null) ??
      (typeof row.fileName === 'string' && row.fileName.trim().length ? row.fileName.trim() : null) ??
      (typeof row.filename === 'string' && row.filename.trim().length ? row.filename.trim() : null) ??
      undefined
    const mimeType = typeof row.mimeType === 'string' && row.mimeType.trim().length ? row.mimeType.trim() : undefined
    out.push({ ...(name ? { name } : {}), url, ...(mimeType ? { mimeType } : {}) })
  }

  for (const key of ['files', 'stagedMailAttachments', 'attachments'] as const) {
    const list = strapiPayload[key]
    if (!Array.isArray(list)) continue
    for (const item of list) push(item)
  }
  return out
}

export type StrapiLeadInjectPayload = Record<string, unknown>

export type MappedStrapiLead = {
  payload: InsuranceLeadPayload
  referralCode: string | null
  referralOwnerName: string | null
}

export function mapStrapiPayloadToInsuranceLead(strapiPayload: StrapiLeadInjectPayload): MappedStrapiLead {
  const stepOne = record(strapiPayload.stepOne)
  const stepTwo = record(strapiPayload.stepTwo)
  const stepThree = record(strapiPayload.stepThree)
  const stepFour = record(strapiPayload.stepFour)
  const stepFinal = record(strapiPayload.stepFinal)

  const vehicle = mapVehicle(stepOne)
  const contact = stepFinal ? mapContact(stepFinal, stepFour) : {}
  const coverages = mapCoveragesFromSelections(stepThree?.selections)
  const coverageOptions = mapCoverageOptions(stepTwo, stepFour)
  const usage = mapUsage(stepTwo)

  const referral = record(strapiPayload.referralCode)
  const referralCodeRaw = referral ? str(referral.code) : ''
  const referralOwnerName = referral ? str(referral.owner) : ''
  const referralCode = referralCodeRaw.length ? normalizeStrapiReferralCode(referralCodeRaw) : null

  const payload: InsuranceLeadPayload = {
    resourceKind: 'external',
    subject: vehicle ? { vehicle } : undefined,
    contact,
    coverages: coverages as unknown as Record<string, unknown>,
    coverageOptions: coverageOptions as unknown as Record<string, unknown>,
    strapi: strapiPayload,
  }
  if (usage) payload.usage = usage
  if (typeof strapiPayload.locale === 'string' && strapiPayload.locale.trim().length) {
    payload.locale = strapiPayload.locale.trim()
  }
  if (typeof strapiPayload.strapiDocumentId === 'string' && strapiPayload.strapiDocumentId.trim().length) {
    payload.strapiDocumentId = strapiPayload.strapiDocumentId.trim()
  }

  const fileRefs = collectStrapiFileRefs(strapiPayload)
  if (fileRefs.length) payload.files = fileRefs

  return {
    payload,
    referralCode,
    referralOwnerName: referralOwnerName.length ? referralOwnerName : null,
  }
}
