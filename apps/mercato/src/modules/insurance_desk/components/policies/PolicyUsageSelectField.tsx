"use client"

import * as React from 'react'
import type { CrudCustomFieldRenderProps } from '@open-mercato/ui/backend/CrudForm'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Label } from '@open-mercato/ui/primitives/label'
import { Switch } from '@open-mercato/ui/primitives/switch'
import { cn } from '@open-mercato/shared/lib/utils'
import { CRUD_FORM_SELECT_CLASS, CRUD_FORM_TEXT_INPUT_CLASS } from '@open-mercato/ui/backend/CrudForm'
import type { LeadUsageFormValue } from '../../lib/leadUsageForm'
import { emptyLeadUsageForm } from '../../lib/leadUsageForm'

function normalize(raw: unknown): LeadUsageFormValue {
  const base = emptyLeadUsageForm()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  if (o.type === 'private' || o.type === 'business') base.type = o.type
  if (o.financing === 'leasing' || o.financing === 'own') base.financing = o.financing
  if (typeof o.leasingCompany === 'string') base.leasingCompany = o.leasingCompany
  if (o.under25 === true || o.under25 === false) base.under25 = o.under25
  if (o.under25 === null) base.under25 = null
  if (o.licenseShort === true || o.licenseShort === false) base.licenseShort = o.licenseShort
  if (o.licenseShort === null) base.licenseShort = null
  return base
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}

function DriverSwitchRow({
  checked,
  onCheckedChange,
  disabled,
  noLabel,
  yesLabel,
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
  noLabel: string
  yesLabel: string
}) {
  return (
    <div className="inline-flex max-w-full flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">{noLabel}</span>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="shrink-0"
      />
      <span className="text-sm text-muted-foreground">{yesLabel}</span>
    </div>
  )
}

/**
 * Same data model as {@link LeadUsageField}, but usage kind and financing use plain selects (policy form).
 */
export function PolicyUsageSelectField(props: CrudCustomFieldRenderProps) {
  const t = useT()
  const { value, setValue, disabled, error } = props
  const model = normalize(value)

  const patch = React.useCallback(
    (partial: Partial<LeadUsageFormValue>) => {
      setValue({ ...normalize(value), ...partial })
    },
    [setValue, value],
  )

  const isBusiness = model.type === 'business'
  const isLeasing = isBusiness && model.financing === 'leasing'

  return (
    <div className={cn('space-y-6', error && 'rounded-md border border-destructive/50 p-3')}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-end">
        <div className="space-y-2">
          <Label htmlFor="policy-usage-type">{t('insurance_desk.leads.usage.typeLabel', 'Vehicle use')}</Label>
          <select
            id="policy-usage-type"
            className={CRUD_FORM_SELECT_CLASS}
            value={model.type}
            disabled={disabled}
            onChange={(e) => {
              const v = e.target.value
              if (v === 'private') patch({ type: 'private', financing: '', leasingCompany: '' })
              else if (v === 'business') patch({ type: 'business' })
              else patch({ type: '', financing: '', leasingCompany: '' })
            }}
          >
            <option value="">{t('insurance_desk.policies.form.usage.selectPlaceholder', 'Select…')}</option>
            <option value="private">{t('insurance_desk.leads.usage.private', 'Private')}</option>
            <option value="business">{t('insurance_desk.leads.usage.business', 'Business')}</option>
          </select>
        </div>

        {isBusiness ? (
          <div className="space-y-2">
            <Label htmlFor="policy-usage-financing">{t('insurance_desk.leads.usage.financingLabel', 'Financing')}</Label>
            <select
              id="policy-usage-financing"
              className={CRUD_FORM_SELECT_CLASS}
              value={model.financing}
              disabled={disabled}
              onChange={(e) => {
                const v = e.target.value
                if (v === 'leasing') patch({ financing: 'leasing' })
                else if (v === 'own') patch({ financing: 'own', leasingCompany: '' })
                else patch({ financing: '', leasingCompany: '' })
              }}
            >
              <option value="">{t('insurance_desk.policies.form.usage.selectPlaceholder', 'Select…')}</option>
              <option value="leasing">{t('insurance_desk.leads.usage.leasing', 'Leasing')}</option>
              <option value="own">{t('insurance_desk.leads.usage.own', 'Cash / own funds')}</option>
            </select>
          </div>
        ) : null}

        {isLeasing ? (
          <div className="space-y-2">
            <Label htmlFor="policy-usage-lc">{t('insurance_desk.leads.usage.leasingCompany', 'Leasing company')}</Label>
            <input
              id="policy-usage-lc"
              className={CRUD_FORM_TEXT_INPUT_CLASS}
              value={model.leasingCompany}
              onChange={(e) => patch({ leasingCompany: e.target.value })}
              disabled={disabled}
              data-crud-focus-target=""
            />
          </div>
        ) : null}
      </div>

      {model.type ? (
        <>
          <SectionLabel>{t('insurance_desk.leads.usage.driversSection', 'Drivers')}</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 space-y-2">
              <Label className="text-sm leading-snug">
                {t('insurance_desk.leads.usage.under25', 'Regular driver under 25')}
              </Label>
              <DriverSwitchRow
                checked={model.under25 === true}
                onCheckedChange={(v) => patch({ under25: v })}
                disabled={disabled}
                noLabel={t('common.no', 'No')}
                yesLabel={t('common.yes', 'Yes')}
              />
            </div>
            <div className="min-w-0 space-y-2">
              <Label className="text-sm leading-snug">
                {t('insurance_desk.leads.usage.licenseShort', 'Licence held under 2 years')}
              </Label>
              <DriverSwitchRow
                checked={model.licenseShort === true}
                onCheckedChange={(v) => patch({ licenseShort: v })}
                disabled={disabled}
                noLabel={t('common.no', 'No')}
                yesLabel={t('common.yes', 'Yes')}
              />
            </div>
          </div>
        </>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
