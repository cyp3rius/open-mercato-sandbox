"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { CrudCustomFieldRenderProps } from '@open-mercato/ui/backend/CrudForm'
import { cn } from '@open-mercato/shared/lib/utils'
import { CRUD_FORM_TEXT_INPUT_CLASS } from '@open-mercato/ui/backend/CrudForm'
import { searchResourceOptionsForPolicySubject } from '../../lib/loadPolicyFormOptions'
import { ComboboxInput } from '@open-mercato/ui/backend/inputs/ComboboxInput'

export type InsuranceSubjectVehicle = {
  brandAndModel: string
  vinNumber: string
  plateNumber: string
  yearOfManufacture: string
  registrationDate: string
  milage: string
}

export type InsuranceSubjectFormValue = {
  mode: 'existing' | 'new_resource'
  resourceId: string
  newResourceName: string
  newResourceDescription: string
  vehicle: InsuranceSubjectVehicle
}

export function emptyInsuranceSubjectValue(): InsuranceSubjectFormValue {
  return {
    mode: 'existing',
    resourceId: '',
    newResourceName: '',
    newResourceDescription: '',
    vehicle: {
      brandAndModel: '',
      vinNumber: '',
      plateNumber: '',
      yearOfManufacture: '',
      registrationDate: '',
      milage: '',
    },
  }
}

function normalize(raw: unknown): InsuranceSubjectFormValue {
  const base = emptyInsuranceSubjectValue()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  if (o.mode === 'new_resource' || o.mode === 'existing') base.mode = o.mode
  if (typeof o.resourceId === 'string') base.resourceId = o.resourceId
  if (typeof o.newResourceName === 'string') base.newResourceName = o.newResourceName
  if (typeof o.newResourceDescription === 'string') base.newResourceDescription = o.newResourceDescription
  const v = o.vehicle
  if (v && typeof v === 'object') {
    const vo = v as Record<string, unknown>
    for (const k of Object.keys(base.vehicle) as (keyof InsuranceSubjectVehicle)[]) {
      if (typeof vo[k] === 'string') base.vehicle[k] = vo[k]
    }
  }
  return base
}

export function emptyVehicleFields(): InsuranceSubjectVehicle {
  return { ...emptyInsuranceSubjectValue().vehicle }
}

/** Hydrate vehicle form fields from `metadata.subject.vehicle` / lead payload JSON. */
export function vehicleFromSubjectJson(raw: unknown): InsuranceSubjectVehicle {
  const base = emptyVehicleFields()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  const str = (x: unknown) =>
    typeof x === 'string'
      ? x
      : x != null && (typeof x === 'number' || typeof x === 'boolean')
        ? String(x)
        : ''
  if (o.brandAndModel != null) base.brandAndModel = str(o.brandAndModel)
  if (o.vinNumber != null) base.vinNumber = str(o.vinNumber)
  if (o.plateNumber != null) base.plateNumber = str(o.plateNumber)
  if (o.yearOfManufacture != null) base.yearOfManufacture = str(o.yearOfManufacture)
  if (o.registrationDate != null) base.registrationDate = str(o.registrationDate).slice(0, 10)
  if (o.milage != null) base.milage = str(o.milage)
  return base
}

/** Short label from vehicle fields (title, resource name, etc.). */
export function deriveLabelFromVehicle(vehicle: InsuranceSubjectVehicle): string {
  const brand = vehicle.brandAndModel.trim()
  const plate = vehicle.plateNumber.trim()
  const vin = vehicle.vinNumber.trim()
  if (brand && plate) return `${brand} · ${plate}`
  if (brand) return brand
  if (plate) return plate
  if (vin) return `VIN ${vin}`
  return ''
}

/** Display name for `resources/resources` when mode is new; prefers explicit name, then vehicle fields. */
export function deriveNewResourceNameForApi(v: InsuranceSubjectFormValue): string {
  const explicit = v.newResourceName.trim()
  if (explicit) return explicit
  return deriveLabelFromVehicle(v.vehicle)
}

function buildVehicleRecord(vehicle: InsuranceSubjectVehicle): Record<string, unknown> | null {
  const out: Record<string, unknown> = {}
  if (vehicle.brandAndModel.trim()) out.brandAndModel = vehicle.brandAndModel.trim()
  if (vehicle.vinNumber.trim()) out.vinNumber = vehicle.vinNumber.trim()
  if (vehicle.plateNumber.trim()) out.plateNumber = vehicle.plateNumber.trim()
  if (vehicle.yearOfManufacture.trim()) {
    const y = Number(vehicle.yearOfManufacture)
    out.yearOfManufacture = Number.isFinite(y) ? y : vehicle.yearOfManufacture.trim()
  }
  if (vehicle.registrationDate.trim()) out.registrationDate = vehicle.registrationDate.trim()
  if (vehicle.milage.trim()) {
    const m = Number(vehicle.milage)
    out.milage = Number.isFinite(m) ? m : vehicle.milage.trim()
  }
  return Object.keys(out).length > 0 ? out : null
}

/** Normalized `{ vehicle: { … } }` for policy metadata or lead payload. */
export function buildInsuranceSubjectMetadata(v: InsuranceSubjectFormValue): Record<string, unknown> | null {
  const vehicle = buildVehicleRecord(v.vehicle)
  if (!vehicle) return null
  return { vehicle }
}

export function PolicySubjectField(props: CrudCustomFieldRenderProps) {
  const t = useT()
  const { value, setValue, disabled, error, values } = props
  const model = normalize(value)

  const resourceSearchScopeId = React.useMemo(() => {
    const raw = values && typeof values === 'object' ? (values as Record<string, unknown>) : null
    const company =
      raw && typeof raw.insuredCompanyEntityId === 'string' ? raw.insuredCompanyEntityId.trim() : ''
    const person =
      raw && typeof raw.insuredPersonEntityId === 'string' ? raw.insuredPersonEntityId.trim() : ''
    if (company.length) return company
    if (person.length) return person
    return ''
  }, [values])

  const noneLabel = t('insurance_desk.policies.form.none', '— none —')
  const loadResourceSuggestions = React.useCallback(
    (query?: string) =>
      searchResourceOptionsForPolicySubject(
        noneLabel,
        typeof query === 'string' ? query : '',
        resourceSearchScopeId.length ? resourceSearchScopeId : null,
      ),
    [noneLabel, resourceSearchScopeId],
  )

  const patch = React.useCallback(
    (partial: Partial<InsuranceSubjectFormValue>) => {
      setValue({ ...normalize(value), ...partial })
    },
    [setValue, value],
  )

  const patchVehicle = React.useCallback(
    (partial: Partial<InsuranceSubjectVehicle>) => {
      const current = normalize(value)
      setValue({
        ...current,
        vehicle: { ...current.vehicle, ...partial },
      })
    },
    [setValue, value],
  )

  return (
    <div className={cn('space-y-4', error && 'rounded-md border border-destructive/50 p-3')}>
      <p className="text-sm text-muted-foreground">
        {t(
          'insurance_desk.policies.form.subject.intro',
          'Choose an existing resource, or enter new vehicle details — a resource record will be created when you save the policy.',
        )}
      </p>
      <div
        className="inline-flex h-9 items-center rounded-md bg-muted p-1 text-muted-foreground"
        role="group"
        aria-label={t('insurance_desk.policies.form.subject.modeSwitchLabel', 'Resource source')}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => patch({ mode: 'existing' })}
          className={cn(
            'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
            model.mode === 'existing'
              ? 'bg-background text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t('insurance_desk.policies.form.subject.modeExisting', 'Existing resource')}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => patch({ mode: 'new_resource' })}
          className={cn(
            'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
            model.mode === 'new_resource'
              ? 'bg-background text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t('insurance_desk.policies.form.subject.modeNew', 'New resource')}
        </button>
      </div>

      {model.mode === 'existing' ? (
        <div className="space-y-1.5">
          <label className="block text-sm font-medium">
            {t('insurance_desk.policies.form.subject.pickResource', 'Resource')}
          </label>
          <ComboboxInput
            value={model.resourceId}
            loadSuggestions={loadResourceSuggestions}
            onChange={(next) => patch({ resourceId: typeof next === 'string' ? next : '' })}
            placeholder={t('insurance_desk.policies.form.subject.searchResource', 'Search resources…')}
            disabled={disabled}
            allowCustomValues={false}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-sm font-medium">
                {t('insurance_desk.policies.form.subject.brandModel', 'Brand and model')}
              </label>
              <input
                className={CRUD_FORM_TEXT_INPUT_CLASS}
                value={model.vehicle.brandAndModel}
                onChange={(e) => patchVehicle({ brandAndModel: e.target.value })}
                disabled={disabled}
                data-crud-focus-target=""
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">{t('insurance_desk.policies.form.subject.vin', 'VIN')}</label>
              <input
                className={CRUD_FORM_TEXT_INPUT_CLASS}
                value={model.vehicle.vinNumber}
                onChange={(e) => patchVehicle({ vinNumber: e.target.value })}
                disabled={disabled}
                data-crud-focus-target=""
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">
                {t('insurance_desk.policies.form.subject.plate', 'Registration plate')}
              </label>
              <input
                className={CRUD_FORM_TEXT_INPUT_CLASS}
                value={model.vehicle.plateNumber}
                onChange={(e) => patchVehicle({ plateNumber: e.target.value })}
                disabled={disabled}
                data-crud-focus-target=""
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">
                {t('insurance_desk.policies.form.subject.year', 'Year of manufacture')}
              </label>
              <input
                className={CRUD_FORM_TEXT_INPUT_CLASS}
                inputMode="numeric"
                value={model.vehicle.yearOfManufacture}
                onChange={(e) => patchVehicle({ yearOfManufacture: e.target.value })}
                disabled={disabled}
                data-crud-focus-target=""
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">
                {t('insurance_desk.policies.form.subject.registrationDate', 'Registration date')}
              </label>
              <input
                className={CRUD_FORM_TEXT_INPUT_CLASS}
                type="date"
                value={model.vehicle.registrationDate}
                onChange={(e) => patchVehicle({ registrationDate: e.target.value })}
                disabled={disabled}
                data-crud-focus-target=""
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">
                {t('insurance_desk.policies.form.subject.milage', 'Mileage (km)')}
              </label>
              <input
                className={CRUD_FORM_TEXT_INPUT_CLASS}
                inputMode="numeric"
                value={model.vehicle.milage}
                onChange={(e) => patchVehicle({ milage: e.target.value })}
                disabled={disabled}
                data-crud-focus-target=""
              />
            </div>
          </div>
        </div>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

export default PolicySubjectField
