/** Stable attachment owner id for `/api/attachments` (no generated entity id for insurance.policy yet). */
export const INSURANCE_POLICY_ATTACHMENT_ENTITY_ID = 'insurance.policy' as const

/** Attachments on insurance lead / zapytanie records. */
export const INSURANCE_LEAD_ATTACHMENT_ENTITY_ID = 'insurance.lead' as const

export const INSURANCE_LEAD_ATTACHMENT_TAG = {
  default: 'insurance.lead.file',
} as const

export const INSURANCE_ATTACHMENT_TAG = {
  polisa: 'insurance.policy.file.polisa',
  inne: 'insurance.policy.file.inne',
  klient: 'insurance.policy.file.klient',
} as const
