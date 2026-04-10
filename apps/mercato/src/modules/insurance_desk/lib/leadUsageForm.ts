export type LeadUsageFormValue = {
  type: '' | 'private' | 'business'
  financing: '' | 'leasing' | 'own'
  leasingCompany: string
  under25: boolean | null
  licenseShort: boolean | null
}

export function emptyLeadUsageForm(): LeadUsageFormValue {
  return {
    type: '',
    financing: '',
    leasingCompany: '',
    under25: null,
    licenseShort: null,
  }
}
