import { deriveNewResourceNameForApi, emptyInsuranceSubjectValue, vehicleFromSubjectJson } from '../components/policies/PolicySubjectField'
import { buildLeadFormValuesFromPayload } from './leadFormPrefill'
import type { InsuranceLeadPayload } from './insuranceLeadPayload'

export type PolicyCreateLeadApiRow = {
  id: string
  title?: string
  referringPartnerEntityId: string | null
  payload: Record<string, unknown> | null
}

/**
 * Builds full CrudForm `initialValues` for policy create from a lead API row.
 * Vehicle data is prefilled for `new_resource`; the resource is created only when the policy is saved.
 */
export function buildPolicyCreateInitialValuesFromLead(
  lead: PolicyCreateLeadApiRow,
  _t: (key: string, fallback: string) => string,
): Record<string, unknown> {
  const payload = (lead.payload ?? {}) as InsuranceLeadPayload
  const leadForm = buildLeadFormValuesFromPayload(lead.referringPartnerEntityId, lead.payload)
  const partner =
    lead.referringPartnerEntityId ??
    (typeof payload.referringPartnerEntityId === 'string' ? payload.referringPartnerEntityId : '') ??
    ''
  const subj = payload.subject
  const vehicleJson =
    subj && typeof subj === 'object' && subj !== null && 'vehicle' in subj
      ? (subj as { vehicle?: unknown }).vehicle
      : undefined
  const insuranceSubject = emptyInsuranceSubjectValue()
  insuranceSubject.mode = 'new_resource'
  insuranceSubject.vehicle = vehicleFromSubjectJson(vehicleJson)
  if (
    !deriveNewResourceNameForApi(insuranceSubject) &&
    typeof lead.title === 'string' &&
    lead.title.trim().length
  ) {
    insuranceSubject.vehicle = {
      ...insuranceSubject.vehicle,
      brandAndModel: insuranceSubject.vehicle.brandAndModel.trim().length
        ? insuranceSubject.vehicle.brandAndModel
        : lead.title.trim(),
    }
  }

  return {
    ...leadForm,
    policyNumber: typeof payload.policyNumber === 'string' ? payload.policyNumber : '',
    insurerId: typeof payload.insurerId === 'string' ? payload.insurerId : '',
    insurerContactId: typeof payload.insurerContactId === 'string' ? payload.insurerContactId : '',
    caretakerUserId: typeof payload.caretakerUserId === 'string' ? payload.caretakerUserId : '',
    referringPartnerEntityId: partner,
    catalogProductId: typeof payload.catalogProductId === 'string' ? payload.catalogProductId : '',
    validFrom: typeof payload.validFrom === 'string' ? payload.validFrom.slice(0, 10) : '',
    validTo: typeof payload.validTo === 'string' ? payload.validTo.slice(0, 10) : '',
    status: typeof payload.status === 'string' ? payload.status : '',
    insuranceSubject,
    sourceLeadId: lead.id,
  }
}
