export type LeadHolderType = 'private' | 'sole' | 'civil' | 'llc' | ''

export type LeadContactFormValue = {
  holderType: LeadHolderType
  fullName: string
  pesel: string
  address: string
  regon: string
  companyName: string
  partnerNames: string
  partnerPesels: string
  phone: string
  email: string
}

export function emptyLeadContactForm(): LeadContactFormValue {
  return {
    holderType: '',
    fullName: '',
    pesel: '',
    address: '',
    regon: '',
    companyName: '',
    partnerNames: '',
    partnerPesels: '',
    phone: '',
    email: '',
  }
}
