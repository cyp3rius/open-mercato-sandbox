import {
  emptyInsuranceSubjectValue,
  type InsuranceSubjectFormValue,
} from '../components/policies/PolicySubjectField'
import type { PolicyListColorEvaluationRow } from '@open-mercato/core/modules/insurance/lib/policyListColorRules'
import type { ReferringPartnerAssociation } from '@open-mercato/core/modules/customers/lib/referringPartnerAssociation'
import { buildLeadFormValuesFromPayload } from './leadFormPrefill'

export type PolicyApiRow = {
  id: string
  policyNumber: string
  insurerId: string
  insurerContactId: string | null
  caretakerUserId: string | null
  referringPartnerEntityId: string | null
  referringPartner?: ReferringPartnerAssociation | null
  catalogProductId: string | null
  resourceId: string | null
  insuredPersonEntityId?: string | null
  insuredCompanyEntityId?: string | null
  validFrom: string | null
  validTo: string | null
  status: string | null
  metadata: Record<string, unknown> | null
  createdAt?: string | null
  updatedAt?: string | null
}

export function policyApiRowToListColorEvalRow(row: PolicyApiRow): PolicyListColorEvaluationRow {
  return {
    policyNumber: row.policyNumber,
    status: row.status,
    validFrom: row.validFrom,
    validTo: row.validTo,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
    insurerId: row.insurerId,
    referringPartnerEntityId: row.referringPartnerEntityId,
    catalogProductId: row.catalogProductId,
    resourceId: row.resourceId,
  }
}

export function duplicatePolicyNumberLabel(original: string): string {
  const s = original.trim()
  const suffix = ' (copy)'
  const max = 191
  if (s.length + suffix.length <= max) return `${s}${suffix}`
  return `${s.slice(0, max - suffix.length)}${suffix}`
}

function buildSubjectInitial(row: PolicyApiRow, meta: Record<string, unknown> | null): InsuranceSubjectFormValue {
  const base = emptyInsuranceSubjectValue()
  base.mode = 'existing'
  base.resourceId = row.resourceId ?? ''
  const sub = meta?.subject
  if (sub && typeof sub === 'object') {
    const vehicle = (sub as Record<string, unknown>).vehicle
    if (vehicle && typeof vehicle === 'object') {
      const v = vehicle as Record<string, unknown>
      base.vehicle = {
        brandAndModel: typeof v.brandAndModel === 'string' ? v.brandAndModel : '',
        vinNumber: typeof v.vinNumber === 'string' ? v.vinNumber : '',
        plateNumber: typeof v.plateNumber === 'string' ? v.plateNumber : '',
        yearOfManufacture: v.yearOfManufacture != null ? String(v.yearOfManufacture) : '',
        registrationDate: typeof v.registrationDate === 'string' ? v.registrationDate.slice(0, 10) : '',
        milage: v.milage != null ? String(v.milage) : '',
      }
    }
  }
  return base
}

function leadStyleFieldsFromPolicyMetadata(meta: Record<string, unknown> | null): Record<string, unknown> {
  const v = buildLeadFormValuesFromPayload(null, meta ?? {})
  return {
    leadContact: v.leadContact,
    leadUsage: v.leadUsage,
    coverages: v.coverages,
    coverageSubSelections: v.coverageSubSelections,
    coverageDetailValues: v.coverageDetailValues,
    coverageOptions: v.coverageOptions,
  }
}

/** Full form state for policy detail (aligned with create flow + lead-style metadata). */
export function policyRowToDetailForm(row: PolicyApiRow): Record<string, unknown> {
  const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : null
  const leadStyle = leadStyleFieldsFromPolicyMetadata(meta)
  return {
    ...leadStyle,
    id: row.id,
    policyNumber: row.policyNumber,
    insurerId: row.insurerId,
    insurerContactId: row.insurerContactId ?? '',
    caretakerUserId: row.caretakerUserId ?? '',
    referringPartnerEntityId: row.referringPartnerEntityId ?? '',
    catalogProductId: row.catalogProductId ?? '',
    validFrom: row.validFrom ? row.validFrom.slice(0, 10) : '',
    validTo: row.validTo ? row.validTo.slice(0, 10) : '',
    status: row.status ?? '',
    insuredPersonEntityId: row.insuredPersonEntityId ?? '',
    insuredCompanyEntityId: row.insuredCompanyEntityId ?? '',
    insuranceSubject: buildSubjectInitial(row, meta),
  }
}

/** Maps an existing policy API row into create-form initial values (e.g. duplicate). */
export function policyApiRowToCreateFormInitial(row: PolicyApiRow): Record<string, unknown> {
  const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : null
  const leadStyle = leadStyleFieldsFromPolicyMetadata(meta)

  return {
    policyNumber: duplicatePolicyNumberLabel(row.policyNumber),
    insurerId: row.insurerId,
    insurerContactId: row.insurerContactId ?? '',
    caretakerUserId: row.caretakerUserId ?? '',
    referringPartnerEntityId: row.referringPartnerEntityId ?? '',
    catalogProductId: row.catalogProductId ?? '',
    validFrom: row.validFrom ? row.validFrom.slice(0, 10) : '',
    validTo: row.validTo ? row.validTo.slice(0, 10) : '',
    status: row.status ?? '',
    insuredPersonEntityId: row.insuredPersonEntityId ?? '',
    insuredCompanyEntityId: row.insuredCompanyEntityId ?? '',
    sourceLeadId: '',
    ...leadStyle,
    insuranceSubject: buildSubjectInitial(row, meta),
  }
}
