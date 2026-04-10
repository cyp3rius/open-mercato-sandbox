"use client"

import * as React from 'react'
import { Label } from '@open-mercato/ui/primitives/label'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { InlineSelectOption } from '@open-mercato/ui/backend/detail'
import { CRUD_FORM_SELECT_CLASS, CRUD_FORM_TEXT_INPUT_CLASS } from '@open-mercato/ui/backend/CrudForm'
import { PolicyInsurerContactField } from './PolicyInsurerContactField'
import { makePolicyDetailFieldProps } from './policyDetailFieldProps'

type Props = {
  form: Record<string, unknown>
  setForm: React.Dispatch<React.SetStateAction<Record<string, unknown>>>
  insurerOptions: InlineSelectOption[]
  partnerOptions: InlineSelectOption[]
  productOptions: InlineSelectOption[]
  caretakerOptions: InlineSelectOption[]
  statusOptions: InlineSelectOption[]
}

function SelectRow(props: {
  id: string
  label: string
  value: string
  options: InlineSelectOption[]
  onChange: (v: string) => void
  required?: boolean
  emptyLabel: string
}) {
  const { id, label, value, options, onChange, required, emptyLabel } = props
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <select
        id={id}
        className={CRUD_FORM_SELECT_CLASS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{emptyLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function PolicyBasicsEditBlock({
  form,
  setForm,
  insurerOptions,
  partnerOptions,
  productOptions,
  caretakerOptions,
  statusOptions,
}: Props) {
  const t = useT()

  const policyNumber = typeof form.policyNumber === 'string' ? form.policyNumber : ''
  const insurerId = typeof form.insurerId === 'string' ? form.insurerId : ''
  const referringPartnerEntityId =
    typeof form.referringPartnerEntityId === 'string' ? form.referringPartnerEntityId : ''
  const catalogProductId = typeof form.catalogProductId === 'string' ? form.catalogProductId : ''
  const caretakerUserId = typeof form.caretakerUserId === 'string' ? form.caretakerUserId : ''
  const validFrom = typeof form.validFrom === 'string' ? form.validFrom : ''
  const validTo = typeof form.validTo === 'string' ? form.validTo : ''
  const status = typeof form.status === 'string' ? form.status : ''

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div className="space-y-2">
        <Label htmlFor="policy-detail-policyNumber">
          {t('insurance_desk.policies.form.policyNumber', 'Policy number')} <span className="text-destructive">*</span>
        </Label>
        <input
          id="policy-detail-policyNumber"
          className={CRUD_FORM_TEXT_INPUT_CLASS}
          value={policyNumber}
          onChange={(e) => setForm((f) => ({ ...f, policyNumber: e.target.value }))}
          data-crud-focus-target=""
        />
      </div>

      <SelectRow
        id="policy-detail-insurerId"
        label={t('insurance_desk.policies.form.insurer', 'Insurer')}
        value={insurerId}
        options={insurerOptions}
        onChange={(v) => setForm((f) => ({ ...f, insurerId: v }))}
        required
        emptyLabel={t('insurance_desk.policies.form.none', '— none —')}
      />

      <div className="md:col-span-2 xl:col-span-1">
        <PolicyInsurerContactField {...makePolicyDetailFieldProps(form, setForm, 'insurerContactId')} />
      </div>

      <SelectRow
        id="policy-detail-caretakerUserId"
        label={t('insurance_desk.policies.form.caretaker', 'Caretaker (our side)')}
        value={caretakerUserId}
        options={caretakerOptions}
        onChange={(v) => setForm((f) => ({ ...f, caretakerUserId: v }))}
        emptyLabel={t('insurance_desk.policies.form.none', '— none —')}
      />

      <SelectRow
        id="policy-detail-referringPartnerEntityId"
        label={t('insurance_desk.policies.form.referringPartyEntity', 'Referring party')}
        value={referringPartnerEntityId}
        options={partnerOptions}
        onChange={(v) => setForm((f) => ({ ...f, referringPartnerEntityId: v }))}
        required
        emptyLabel={t('insurance_desk.policies.form.none', '— none —')}
      />

      <SelectRow
        id="policy-detail-catalogProductId"
        label={t('insurance_desk.policies.form.catalogProduct', 'Catalog product')}
        value={catalogProductId}
        options={productOptions}
        onChange={(v) => setForm((f) => ({ ...f, catalogProductId: v }))}
        emptyLabel={t('insurance_desk.policies.form.none', '— none —')}
      />

      <div className="space-y-2">
        <Label htmlFor="policy-detail-validFrom">{t('insurance_desk.policies.form.validFrom', 'Valid from')}</Label>
        <input
          id="policy-detail-validFrom"
          className={CRUD_FORM_TEXT_INPUT_CLASS}
          type="date"
          value={validFrom}
          onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
          data-crud-focus-target=""
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="policy-detail-validTo">{t('insurance_desk.policies.form.validTo', 'Valid to')}</Label>
        <input
          id="policy-detail-validTo"
          className={CRUD_FORM_TEXT_INPUT_CLASS}
          type="date"
          value={validTo}
          onChange={(e) => setForm((f) => ({ ...f, validTo: e.target.value }))}
          data-crud-focus-target=""
        />
      </div>

      <SelectRow
        id="policy-detail-status"
        label={t('insurance_desk.policies.form.status', 'Status')}
        value={status}
        options={statusOptions}
        onChange={(v) => setForm((f) => ({ ...f, status: v }))}
        required
        emptyLabel={t('insurance_desk.policies.form.none', '— none —')}
      />
    </div>
  )
}
