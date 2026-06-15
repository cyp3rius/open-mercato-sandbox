import { mapStrapiPayloadToInsuranceLead, normalizeStrapiReferralCode } from '../strapiLeadMapper'

const samplePayload = {
  strapiDocumentId: 'vivdh551vrrmy4il4ijwqls0',
  hash: '0c3e0fd0-06bd-44f6-b2a9-227f6cff9823',
  locale: 'pl',
  createdAt: '2026-06-15T09:30:00.000Z',
  referralCode: {
    code: 'jan-kowalski',
    owner: 'Jan Kowalski',
  },
  stepOne: {
    brandAndModel: 'Fiat Ducato Multijet 140',
    plateNumber: 'WA 12345',
    vinNumber: 'ZFA25000001234567',
    registrationDate: '2020-03-15',
    yearOfManufacture: 2020,
    milage: '85000',
  },
  stepTwo: {
    typeOfUse: 'Działalność gospodarcza',
    financingMethod: 'Leasing',
    leasingCompany: 'PKO Leasing',
    usingByUnder25: false,
    drivingLicenseLessThan2: false,
  },
  stepThree: {
    selections: [{ title: 'OC' }, { title: 'AC' }, { title: 'Assistance' }],
  },
  stepFour: {
    fixedInsuranceSum: true,
    insuredValueBasis: 'Brutto',
    vehicleEquipment: 'Klimatyzacja, hak holowniczy, markiza',
    territorialScope: 'Europa',
    towingLimit: 'Bez limitu',
    claimAssessment: 'Serwis ASO',
    partsType: 'Oryginalne',
    partsDepreciation: false,
    deductible: true,
    sumConsumption: false,
    isCompany: true,
    isFundedOwn: false,
    deductibleAmount: '500 PLN',
  },
  stepFinal: {
    entityType: 'Jednoosobowa działalność',
    fullname: 'Jan Kowalski',
    phone: '+48123456789',
    email: 'jan.kowalski@example.com',
    additionalInfo: 'Preferuję kontakt mailowy po 16:00',
    consent: true,
    pesel: '80010112345',
  },
}

describe('normalizeStrapiReferralCode', () => {
  it('strips non-alphanumeric characters for CRM validation', () => {
    expect(normalizeStrapiReferralCode('jan-kowalski')).toBe('jankowalski')
  })
})

describe('mapStrapiPayloadToInsuranceLead', () => {
  it('maps vehicle, contact, coverages, usage and referral metadata', () => {
    const mapped = mapStrapiPayloadToInsuranceLead(samplePayload)

    expect(mapped.referralCode).toBe('jankowalski')
    expect(mapped.referralOwnerName).toBe('Jan Kowalski')
    expect(mapped.payload.resourceKind).toBe('external')
    expect(mapped.payload.subject?.vehicle).toMatchObject({
      brandAndModel: 'Fiat Ducato Multijet 140',
      plateNumber: 'WA 12345',
      vinNumber: 'ZFA25000001234567',
    })
    expect(mapped.payload.contact).toMatchObject({
      holderType: 'sole',
      fullName: 'Jan Kowalski',
      email: 'jan.kowalski@example.com',
      phone: '+48123456789',
      pesel: '80010112345',
      notes: 'Preferuję kontakt mailowy po 16:00',
    })
    expect(mapped.payload.coverages?.OC).toMatchObject({ enabled: true })
    expect(mapped.payload.coverages?.AC).toMatchObject({ enabled: true })
    expect(mapped.payload.coverages?.ASSISTANCE).toMatchObject({ enabled: true })
    expect(mapped.payload.coverageOptions).toMatchObject({
      typeOfUse: 'Działalność gospodarcza',
      financingMethod: 'Leasing',
      leasingCompany: 'PKO Leasing',
      territorialScope: 'Europa',
      deductibleAmount: '500 PLN',
    })
    expect(mapped.payload.usage).toMatchObject({
      type: 'business',
      financing: 'leasing',
      leasingCompany: 'PKO Leasing',
      under25: false,
      licenseShort: false,
    })
    expect(mapped.payload.strapi).toEqual(samplePayload)
  })
})
