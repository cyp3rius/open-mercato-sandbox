/**
 * Documented shape for `InsuranceLead.payload` (JSON). External APIs may send a superset;
 * UI and policy prefill read optional fields from here.
 */
export type InsuranceLeadContact = {
  /** Defaults to `private` when omitted. */
  personType?: 'private' | 'business'
  /** Applicant / policyholder category (inquiry wizard). */
  holderType?: 'private' | 'sole' | 'civil' | 'llc'
  firstName?: string
  lastName?: string
  fullName?: string
  pesel?: string
  regon?: string
  partnerNames?: string
  partnerPesels?: string
  companyName?: string
  email?: string
  phone?: string
  mobile?: string
  address?: {
    street?: string
    houseNumber?: string
    apartmentNumber?: string
    postalCode?: string
    city?: string
    /** ISO 3166-1 alpha-2 */
    countryCode?: string
  }
  notes?: string
}

export type InsuranceLeadPayload = {
  /** Lead subject is not a platform resource — inquiries are external until a policy is issued. */
  resourceKind?: 'external'
  /** Same shape as policy `metadata.subject` — vehicle snapshot for the inquiry. */
  subject?: { vehicle?: Record<string, unknown> }
  /** Insured / applicant contact — used when issuing a policy from the inquiry (CRM person/company + resource). */
  contact?: InsuranceLeadContact
  /** CRM person created at inject time for the inquiry contact (dedup on policy issue). */
  crmContactEntityId?: string
  /** Suggested policy number when creating a policy from this lead. */
  policyNumber?: string
  /** @deprecated Set on the policy; kept for older payloads. */
  insurerId?: string
  /** @deprecated Set on the policy; kept for older payloads. */
  insurerContactId?: string | null
  catalogProductId?: string | null
  referringPartnerEntityId?: string
  caretakerUserId?: string | null
  validFrom?: string
  validTo?: string
  status?: string
  /** Remote file references from the channel (name/url); platform files use `/api/attachments` on the lead. */
  files?: Array<{ name?: string; url?: string; mimeType?: string }>
  notes?: string
  /** Prefill for policy form — same structure as `emptyPolicyCoveragesValue()`. */
  coverages?: Record<string, unknown>
  /** Prefill for policy form — same structure as `emptyCoverageOptionsValue()`. */
  coverageOptions?: Record<string, unknown>
  /** Vehicle use (inquiry wizard) — mirrors calculator usage step. */
  usage?: {
    type?: 'private' | 'business'
    financing?: 'leasing' | 'own'
    leasingCompany?: string
    under25?: boolean | null
    licenseShort?: boolean | null
  }
  /** Per catalog option value → selected additional option (e.g. glass ORIGINAL / AFTERMARKET). */
  coverageSubSelections?: Record<string, string>
  /** Extra field values keyed by catalog option `value`, then `propertyKey`. */
  coverageDetailValues?: Record<string, Record<string, unknown>>
  [key: string]: unknown
}
