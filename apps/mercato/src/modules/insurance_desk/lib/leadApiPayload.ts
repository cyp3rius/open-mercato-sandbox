import type { InsuranceLeadPayload } from './insuranceLeadPayload'
import { buildLeadPayloadExtras, leadContactFormToApi, mergeUsageIntoCoverageOptions } from './leadPayloadMappers'
import { emptyPolicyCoveragesValue } from '../components/policies/PolicyCoveragesField'
import { emptyCoverageOptionsValue } from '../components/policies/PolicyCoverageOptionsField'
import {
  buildInsuranceSubjectMetadata,
  deriveLabelFromVehicle,
  emptyInsuranceSubjectValue,
  emptyVehicleFields,
  type InsuranceSubjectVehicle,
} from '../components/policies/PolicySubjectField'

function trimStr(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function buildLeadPayloadFromFormValues(values: Record<string, unknown>): InsuranceLeadPayload {
  const leadVehicle =
    values.leadVehicle && typeof values.leadVehicle === 'object'
      ? (values.leadVehicle as InsuranceSubjectVehicle)
      : emptyVehicleFields()

  const subjectWrapper = buildInsuranceSubjectMetadata({
    ...emptyInsuranceSubjectValue(),
    vehicle: leadVehicle,
  })
  if (!subjectWrapper) {
    throw new Error('LEAD_VEHICLE_REQUIRED')
  }

  const contact = leadContactFormToApi(values.leadContact)

  const coveragesRaw = values.coverages
  const coveragesForm =
    coveragesRaw && typeof coveragesRaw === 'object'
      ? (coveragesRaw as ReturnType<typeof emptyPolicyCoveragesValue>)
      : emptyPolicyCoveragesValue()
  const covOptRaw = values.coverageOptions
  const covOptBase =
    covOptRaw && typeof covOptRaw === 'object'
      ? (covOptRaw as ReturnType<typeof emptyCoverageOptionsValue>)
      : emptyCoverageOptionsValue()
  const covOptForm = mergeUsageIntoCoverageOptions(values.leadUsage, covOptBase)

  const subsRaw = values.coverageSubSelections
  const coverageSubSelections =
    subsRaw && typeof subsRaw === 'object' ? (subsRaw as Record<string, string>) : {}
  const detRaw = values.coverageDetailValues
  const coverageDetailValues =
    detRaw && typeof detRaw === 'object' ? (detRaw as Record<string, Record<string, unknown>>) : {}

  const notesRaw = trimStr(values.notes)

  const payload: InsuranceLeadPayload = {
    resourceKind: 'external',
    subject: subjectWrapper,
    contact,
    coverages: coveragesForm as unknown as Record<string, unknown>,
    coverageOptions: covOptForm as unknown as Record<string, unknown>,
    ...buildLeadPayloadExtras(values.leadUsage, coverageSubSelections, coverageDetailValues),
  }
  if (notesRaw.length) payload.notes = notesRaw
  return payload
}

export function deriveLeadTitleFromForm(values: Record<string, unknown>, fallbackTitle: string): string {
  const leadVehicle =
    values.leadVehicle && typeof values.leadVehicle === 'object'
      ? (values.leadVehicle as InsuranceSubjectVehicle)
      : emptyVehicleFields()
  const derived = deriveLabelFromVehicle(leadVehicle).trim()
  return derived.length ? derived : fallbackTitle.trim()
}
