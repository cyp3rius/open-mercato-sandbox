import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { createCrudFormError } from '@open-mercato/ui/backend/utils/serverErrors'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import type { InsuranceSubjectVehicle } from '../components/policies/PolicySubjectField'

const EXTERNAL_VEHICLE_RESOURCE_TYPE_NAMES = [
  'Pojazd (zewnętrzny)',
  'External vehicle (external)',
] as const

type PagedResourceTypes = { items?: Array<{ id?: string; name?: string }> }

export async function resolveExternalVehicleResourceTypeId(): Promise<string | null> {
  const call = await apiCall<PagedResourceTypes>('/api/resources/resource-types?page=1&pageSize=100')
  const items = call.result?.items ?? []
  const want = new Set(
    EXTERNAL_VEHICLE_RESOURCE_TYPE_NAMES.map((name) => name.trim().toLowerCase()),
  )
  for (const row of items) {
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    if (!name.length) continue
    if (want.has(name.toLowerCase()) && typeof row.id === 'string') {
      return row.id
    }
  }
  return null
}

function parsePositiveInt(raw: string): number | undefined {
  const trimmed = raw.trim()
  if (!trimmed.length) return undefined
  const n = Number.parseInt(trimmed, 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export function buildVehicleResourceCustomFields(
  vehicle: InsuranceSubjectVehicle,
): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  const plate = vehicle.plateNumber.trim()
  if (plate.length) out.vehicle_plate = plate
  const model = vehicle.brandAndModel.trim()
  if (model.length) out.vehicle_model = model
  const vin = vehicle.vinNumber.trim()
  if (vin.length) out.vehicle_vin_number = vin
  const year = parsePositiveInt(vehicle.yearOfManufacture)
  if (year !== undefined) out.vehicle_year_of_manufacture = year
  const reg = vehicle.registrationDate.trim()
  if (reg.length) out.vehicle_registration_date = reg.slice(0, 10)
  const mileage = parsePositiveInt(vehicle.milage)
  if (mileage !== undefined) out.vehicle_mileage_km = mileage
  return out
}

export function buildExternalVehicleResourceCreateBody(input: {
  name: string
  description: string | null
  vehicle: InsuranceSubjectVehicle
  resourceTypeId: string
}): Record<string, unknown> {
  const customFields = buildVehicleResourceCustomFields(input.vehicle)
  const body: Record<string, unknown> = {
    name: input.name,
    description: input.description,
    isActive: true,
    resourceTypeId: input.resourceTypeId,
  }
  if (Object.keys(customFields).length) {
    body.customFields = customFields
  }
  return body
}

type Translate = (key: string, fallback: string) => string

export async function createInsuranceExternalVehicleResource(input: {
  t: Translate
  name: string
  description: string | null
  vehicle: InsuranceSubjectVehicle
}): Promise<string> {
  const resourceTypeId = await resolveExternalVehicleResourceTypeId()
  if (!resourceTypeId) {
    const msg = input.t(
      'insurance_desk.policies.form.subject.errors.externalVehicleResourceType',
      'No resource type “Pojazd (zewnętrzny)” was found. Add it under Resources → types, then try again.',
    )
    throw createCrudFormError(msg, { insuranceSubject: msg })
  }
  const createRes = await createCrud<{ id?: string }>(
    'resources/resources',
    buildExternalVehicleResourceCreateBody({
      name: input.name,
      description: input.description,
      vehicle: input.vehicle,
      resourceTypeId,
    }),
    {
      errorMessage: input.t(
        'insurance_desk.policies.form.subject.errors.createResource',
        'Could not create resource.',
      ),
    },
  )
  const newId = typeof createRes.result?.id === 'string' ? createRes.result.id : null
  if (!newId) {
    throw createCrudFormError(
      input.t(
        'insurance_desk.policies.form.subject.errors.createResource',
        'Could not create resource.',
      ),
      {
        insuranceSubject: input.t(
          'insurance_desk.policies.form.subject.errors.createResource',
          'Could not create resource.',
        ),
      },
    )
  }
  return newId
}
