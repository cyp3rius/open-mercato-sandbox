"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { CrudCustomFieldRenderProps } from '@open-mercato/ui/backend/CrudForm'
import { cn } from '@open-mercato/shared/lib/utils'
import { CRUD_FORM_TEXT_INPUT_CLASS } from '@open-mercato/ui/backend/CrudForm'
import {
  emptyVehicleFields,
  type InsuranceSubjectVehicle,
} from '../policies/PolicySubjectField'

function normalize(raw: unknown): InsuranceSubjectVehicle {
  const base = emptyVehicleFields()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  for (const k of Object.keys(base) as (keyof InsuranceSubjectVehicle)[]) {
    if (typeof o[k] === 'string') base[k] = o[k]
  }
  return base
}

/**
 * Vehicle-only subject for insurance inquiries (external — no registered resource).
 * Same field set as the policy “new resource” vehicle block.
 */
export function LeadInquiryVehicleField(props: CrudCustomFieldRenderProps) {
  const t = useT()
  const { value, setValue, disabled, error } = props
  const model = normalize(value)

  const patch = React.useCallback(
    (partial: Partial<InsuranceSubjectVehicle>) => {
      setValue({ ...normalize(value), ...partial })
    },
    [setValue, value],
  )

  return (
    <div className={cn('space-y-2', error && 'rounded-md border border-destructive/50 p-3')}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <label className="block text-sm font-medium">
            {t('insurance_desk.policies.form.subject.brandModel', 'Brand and model')}
          </label>
          <input
            className={CRUD_FORM_TEXT_INPUT_CLASS}
            value={model.brandAndModel}
            onChange={(e) => patch({ brandAndModel: e.target.value })}
            disabled={disabled}
            data-crud-focus-target=""
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium">{t('insurance_desk.policies.form.subject.vin', 'VIN')}</label>
          <input
            className={CRUD_FORM_TEXT_INPUT_CLASS}
            value={model.vinNumber}
            onChange={(e) => patch({ vinNumber: e.target.value })}
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
            value={model.plateNumber}
            onChange={(e) => patch({ plateNumber: e.target.value })}
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
            value={model.yearOfManufacture}
            onChange={(e) => patch({ yearOfManufacture: e.target.value })}
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
            value={model.registrationDate}
            onChange={(e) => patch({ registrationDate: e.target.value })}
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
            value={model.milage}
            onChange={(e) => patch({ milage: e.target.value })}
            disabled={disabled}
            data-crud-focus-target=""
          />
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

export default LeadInquiryVehicleField
