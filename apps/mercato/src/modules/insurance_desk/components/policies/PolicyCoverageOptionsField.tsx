"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { CrudCustomFieldRenderProps } from '@open-mercato/ui/backend/CrudForm'
import { Checkbox } from '@open-mercato/ui/primitives/checkbox'
import { Label } from '@open-mercato/ui/primitives/label'
import { Switch } from '@open-mercato/ui/primitives/switch'
import { cn } from '@open-mercato/shared/lib/utils'
import {
  CRUD_FORM_SELECT_CLASS,
  CRUD_FORM_TEXT_INPUT_CLASS,
  CRUD_FORM_TEXTAREA_CLASS,
} from '@open-mercato/ui/backend/CrudForm'
import { normalizeCoveragesValue } from './PolicyCoveragesField'

export type CoverageOptionsFormValue = {
  claimAssessment: string
  financingMethod: string
  typeOfUse: string
  leasingCompany: string
  deductible: boolean
  deductibleAmount: string
  fixedInsuranceSum: boolean
  insuredValueBasis: string
  partsDepreciation: boolean
  partsType: string
  sumConsumption: boolean
  territorialScope: string
  towingLimit: string
  vehicleEquipment: string
  drivingLicenseLessThan2: boolean
  usingByUnder25: boolean
  isCompany: boolean
  isFundedOwn: boolean
}

export function emptyCoverageOptionsValue(): CoverageOptionsFormValue {
  return {
    claimAssessment: '',
    financingMethod: '',
    typeOfUse: '',
    leasingCompany: '',
    deductible: false,
    deductibleAmount: '',
    fixedInsuranceSum: false,
    insuredValueBasis: '',
    partsDepreciation: false,
    partsType: '',
    sumConsumption: false,
    territorialScope: '',
    towingLimit: '',
    vehicleEquipment: '',
    drivingLicenseLessThan2: false,
    usingByUnder25: false,
    isCompany: false,
    isFundedOwn: false,
  }
}

function normalize(raw: unknown): CoverageOptionsFormValue {
  const base = emptyCoverageOptionsValue()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  for (const key of Object.keys(base) as (keyof CoverageOptionsFormValue)[]) {
    const v = o[key]
    if (typeof base[key] === 'boolean') {
      ;(base as Record<string, unknown>)[key] = Boolean(v)
    } else if (typeof base[key] === 'string') {
      ;(base as Record<string, unknown>)[key] = typeof v === 'string' ? v : ''
    }
  }
  return base
}

export function buildCoverageOptionsMetadata(v: CoverageOptionsFormValue): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const str = (s: string) => (s.trim().length ? s.trim() : null)
  const opt = (s: string) => (s.trim().length ? s.trim() : null)
  out.claimAssessment = opt(v.claimAssessment)
  out.financingMethod = opt(v.financingMethod)
  out.typeOfUse = opt(v.typeOfUse)
  out.leasingCompany = str(v.leasingCompany)
  out.deductible = v.deductible
  out.deductibleAmount = str(v.deductibleAmount)
  out.fixedInsuranceSum = v.fixedInsuranceSum
  out.insuredValueBasis = opt(v.insuredValueBasis)
  out.partsDepreciation = v.partsDepreciation
  out.partsType = opt(v.partsType)
  out.sumConsumption = v.sumConsumption
  out.territorialScope = opt(v.territorialScope)
  out.towingLimit = opt(v.towingLimit)
  out.vehicleEquipment = str(v.vehicleEquipment)
  out.drivingLicenseLessThan2 = v.drivingLicenseLessThan2
  out.usingByUnder25 = v.usingByUnder25
  out.isCompany = v.isCompany
  out.isFundedOwn = v.isFundedOwn
  for (const k of Object.keys(out)) {
    const val = out[k]
    if (val === null || val === false || val === '') {
      delete out[k]
    }
  }
  return out
}

type Opt = { value: string; labelKey: string; fallback: string; options: { value: string; labelKey: string; fallback: string }[] }

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}

function leadUsageIsBusiness(values: unknown): boolean {
  if (!values || typeof values !== 'object') return false
  const lu = (values as Record<string, unknown>).leadUsage
  if (!lu || typeof lu !== 'object') return false
  return (lu as { type?: string }).type === 'business'
}

function BooleanSwitchRow({
  checked,
  onCheckedChange,
  disabled,
  noLabel,
  yesLabel,
}: {
  checked: boolean
  onCheckedChange: (next: boolean) => void
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

export function PolicyCoverageOptionsField(props: CrudCustomFieldRenderProps) {
  const t = useT()
  const { value, setValue, disabled, error, entityId, values } = props
  const model = normalize(value)
  const isLeadForm =
    typeof entityId === 'string' &&
    (entityId.includes('insurance_desk:lead') || entityId === 'insurance_desk:policy-create')
  const coveragesForLead = isLeadForm ? normalizeCoveragesValue(values?.coverages) : null
  const hasAc = coveragesForLead?.AC?.enabled === true
  const hasAssist = coveragesForLead?.ASSISTANCE?.enabled === true

  const patch = React.useCallback(
    (partial: Partial<CoverageOptionsFormValue>) => {
      setValue({ ...normalize(value), ...partial })
    },
    [setValue, value],
  )

  const selectBlocks: Opt[] = React.useMemo(
    () => [
      {
        value: 'claimAssessment',
        labelKey: 'insurance_desk.policies.form.coverageOptions.claimAssessment',
        fallback: 'Claim settlement',
        options: [
          { value: '', labelKey: 'insurance_desk.policies.form.coverageOptions.empty', fallback: '—' },
          { value: 'Serwis ASO', labelKey: 'insurance_desk.policies.form.coverageOptions.aso', fallback: 'ASO service' },
          { value: 'Warsztat partnerski', labelKey: 'insurance_desk.policies.form.coverageOptions.partner', fallback: 'Partner workshop' },
          { value: 'Kosztorys', labelKey: 'insurance_desk.policies.form.coverageOptions.estimate', fallback: 'Estimate' },
        ],
      },
      {
        value: 'financingMethod',
        labelKey: 'insurance_desk.policies.form.coverageOptions.financingMethod',
        fallback: 'Financing',
        options: [
          { value: '', labelKey: 'insurance_desk.policies.form.coverageOptions.empty', fallback: '—' },
          { value: 'Leasing', labelKey: 'insurance_desk.policies.form.coverageOptions.leasing', fallback: 'Leasing' },
          { value: 'Zakup własny', labelKey: 'insurance_desk.policies.form.coverageOptions.cash', fallback: 'Cash purchase' },
        ],
      },
      {
        value: 'typeOfUse',
        labelKey: 'insurance_desk.policies.form.coverageOptions.typeOfUse',
        fallback: 'Type of use',
        options: [
          { value: '', labelKey: 'insurance_desk.policies.form.coverageOptions.empty', fallback: '—' },
          { value: 'Prywatnie', labelKey: 'insurance_desk.policies.form.coverageOptions.private', fallback: 'Private' },
          { value: 'Działalność gospodarcza', labelKey: 'insurance_desk.policies.form.coverageOptions.business', fallback: 'Business' },
        ],
      },
      {
        value: 'insuredValueBasis',
        labelKey: 'insurance_desk.policies.form.coverageOptions.insuredValueBasis',
        fallback: 'Value basis',
        options: [
          { value: '', labelKey: 'insurance_desk.policies.form.coverageOptions.empty', fallback: '—' },
          { value: 'Netto', labelKey: 'insurance_desk.policies.form.coverageOptions.net', fallback: 'Net' },
          { value: 'Brutto', labelKey: 'insurance_desk.policies.form.coverageOptions.gross', fallback: 'Gross' },
          { value: 'Brutto z 1/2 VAT', labelKey: 'insurance_desk.policies.form.coverageOptions.grossHalfVat', fallback: 'Gross + ½ VAT' },
        ],
      },
      {
        value: 'partsType',
        labelKey: 'insurance_desk.policies.form.coverageOptions.partsType',
        fallback: 'Parts',
        options: [
          { value: '', labelKey: 'insurance_desk.policies.form.coverageOptions.empty', fallback: '—' },
          { value: 'Oryginalne', labelKey: 'insurance_desk.policies.form.coverageOptions.oem', fallback: 'OEM' },
          { value: 'Zamienniki', labelKey: 'insurance_desk.policies.form.coverageOptions.aftermarket', fallback: 'Aftermarket' },
        ],
      },
      {
        value: 'territorialScope',
        labelKey: 'insurance_desk.policies.form.coverageOptions.territorialScope',
        fallback: 'Territorial scope',
        options: [
          { value: '', labelKey: 'insurance_desk.policies.form.coverageOptions.empty', fallback: '—' },
          { value: 'Polska', labelKey: 'insurance_desk.policies.form.coverageOptions.pl', fallback: 'Poland' },
          { value: 'Europa', labelKey: 'insurance_desk.policies.form.coverageOptions.eu', fallback: 'Europe' },
        ],
      },
      {
        value: 'towingLimit',
        labelKey: 'insurance_desk.policies.form.coverageOptions.towingLimit',
        fallback: 'Towing limit',
        options: [
          { value: '', labelKey: 'insurance_desk.policies.form.coverageOptions.empty', fallback: '—' },
          { value: 'do 200 km', labelKey: 'insurance_desk.policies.form.coverageOptions.tow200', fallback: 'up to 200 km' },
          { value: 'do 1 000 km', labelKey: 'insurance_desk.policies.form.coverageOptions.tow1000', fallback: 'up to 1000 km' },
          { value: 'Bez limitu', labelKey: 'insurance_desk.policies.form.coverageOptions.towUnlimited', fallback: 'Unlimited' },
        ],
      },
    ],
    [],
  )

  const renderSelect = (block: Opt) => (
    <div key={block.value} className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{t(block.labelKey, block.fallback)}</Label>
      <select
        className={CRUD_FORM_SELECT_CLASS}
        value={String(model[block.value as keyof CoverageOptionsFormValue] ?? '')}
        disabled={disabled}
        onChange={(e) => patch({ [block.value]: e.target.value } as Partial<CoverageOptionsFormValue>)}
      >
        {block.options.map((o) => (
          <option key={o.value || 'empty'} value={o.value}>
            {t(o.labelKey, o.fallback)}
          </option>
        ))}
      </select>
    </div>
  )

  const blockByValue = React.useCallback(
    (key: string) => selectBlocks.find((b) => b.value === key),
    [selectBlocks],
  )

  if (isLeadForm && coveragesForLead) {
    const asstKeys = ['territorialScope', 'towingLimit'] as const
    const usageBusiness = leadUsageIsBusiness(values)
    const typeOfUseBusiness = model.typeOfUse === 'Działalność gospodarcza'
    const showPartsDepreciation = usageBusiness || typeOfUseBusiness
    const claimAssessmentBlock = blockByValue('claimAssessment')
    const partsTypeBlock = blockByValue('partsType')
    const insuredBasisBlock = blockByValue('insuredValueBasis')
    const insuredValueLabel = t(
      'insurance_desk.leads.coverageOptions.insuranceFromValue',
      'Insurance from value',
    )
    return (
      <div className={cn('space-y-6', error && 'rounded-md border border-destructive/50 p-3')}>
        {hasAc ? (
          <div className="space-y-4">
            <SectionLabel>{t('insurance_desk.leads.coverageDetails.acSection', 'AC')}</SectionLabel>
            <div className="grid gap-3 lg:grid-cols-3">
              {claimAssessmentBlock ? renderSelect(claimAssessmentBlock) : null}
              {partsTypeBlock ? renderSelect(partsTypeBlock) : null}
              {showPartsDepreciation ? (
                <div className="flex flex-col justify-end gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {t('insurance_desk.policies.form.coverageOptions.partsDepreciation', 'Parts depreciation')}
                  </Label>
                  <BooleanSwitchRow
                    checked={model.partsDepreciation}
                    onCheckedChange={(v) => patch({ partsDepreciation: v })}
                    disabled={disabled}
                    noLabel={t('common.no', 'No')}
                    yesLabel={t('common.yes', 'Yes')}
                  />
                </div>
              ) : null}
            </div>
            <div className="grid gap-4 rounded-md border border-border bg-muted/20 p-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  {t('insurance_desk.policies.form.coverageOptions.deductible', 'Own share')}
                </Label>
                <BooleanSwitchRow
                  checked={model.deductible}
                  onCheckedChange={(v) => patch({ deductible: v })}
                  disabled={disabled}
                  noLabel={t('common.no', 'No')}
                  yesLabel={t('common.yes', 'Yes')}
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  className={cn(
                    'text-xs',
                    model.deductible ? 'text-muted-foreground' : 'text-muted-foreground/50',
                  )}
                >
                  {t('insurance_desk.policies.form.coverageOptions.deductibleAmount', 'Own share amount')}
                </Label>
                <input
                  className={CRUD_FORM_TEXT_INPUT_CLASS}
                  value={model.deductibleAmount}
                  onChange={(e) => patch({ deductibleAmount: e.target.value })}
                  disabled={disabled || !model.deductible}
                  data-crud-focus-target=""
                />
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  {t('insurance_desk.policies.form.coverageOptions.fixedSum', 'Fixed sum insured')}
                </Label>
                <BooleanSwitchRow
                  checked={model.fixedInsuranceSum}
                  onCheckedChange={(v) => patch({ fixedInsuranceSum: v })}
                  disabled={disabled}
                  noLabel={t('common.no', 'No')}
                  yesLabel={t('common.yes', 'Yes')}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  {t('insurance_desk.leads.coverageOptions.sumConsumptionLong', 'Sum consumption')}
                </Label>
                <BooleanSwitchRow
                  checked={model.sumConsumption}
                  onCheckedChange={(v) => patch({ sumConsumption: v })}
                  disabled={disabled}
                  noLabel={t('common.no', 'No')}
                  yesLabel={t('common.yes', 'Yes')}
                />
              </div>
              {insuredBasisBlock ? (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{insuredValueLabel}</Label>
                  <select
                    className={CRUD_FORM_SELECT_CLASS}
                    value={String(model.insuredValueBasis ?? '')}
                    disabled={disabled}
                    onChange={(e) => patch({ insuredValueBasis: e.target.value })}
                  >
                    {insuredBasisBlock.options.map((o) => (
                      <option key={o.value || 'empty'} value={o.value}>
                        {t(o.labelKey, o.fallback)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {t('insurance_desk.policies.form.coverageOptions.vehicleEquipmentLong', 'Vehicle equipment')}
              </Label>
              <textarea
                rows={4}
                className={cn(CRUD_FORM_TEXTAREA_CLASS, 'min-h-24 resize-y')}
                value={model.vehicleEquipment}
                onChange={(e) => patch({ vehicleEquipment: e.target.value })}
                disabled={disabled}
                data-crud-focus-target=""
              />
            </div>
          </div>
        ) : null}
        {hasAssist ? (
          <div className="space-y-4">
            <SectionLabel>{t('insurance_desk.leads.coverageDetails.assistanceSection', 'Assistance')}</SectionLabel>
            <div className="grid gap-3 sm:grid-cols-2">
              {asstKeys.map((k) => {
                const b = blockByValue(k)
                return b ? renderSelect(b) : null
              })}
            </div>
          </div>
        ) : null}
        {!hasAc && !hasAssist ? (
          <div className="w-full rounded-md border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
            {t(
              'insurance_desk.leads.coverageDetails.pickCoverage',
              'Select AC and/or Assistance in “Coverage scope” to configure these preferences.',
            )}
          </div>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', error && 'rounded-md border border-destructive/50 p-3')}>
      <p className="text-sm font-medium text-foreground">
        {t('insurance_desk.policies.form.coverageOptions.intro', 'Detailed motor policy options (aligns with underwriting questionnaires).')}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {selectBlocks.map((block) => renderSelect(block))}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">{t('insurance_desk.policies.form.coverageOptions.leasingCompany', 'Leasing company')}</Label>
        <input
          className={CRUD_FORM_TEXT_INPUT_CLASS}
          value={model.leasingCompany}
          onChange={(e) => patch({ leasingCompany: e.target.value })}
          disabled={disabled}
          data-crud-focus-target=""
        />
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={model.deductible} onCheckedChange={(c) => patch({ deductible: c === true })} disabled={disabled} />
          {t('insurance_desk.policies.form.coverageOptions.deductible', 'Own share')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={model.fixedInsuranceSum} onCheckedChange={(c) => patch({ fixedInsuranceSum: c === true })} disabled={disabled} />
          {t('insurance_desk.policies.form.coverageOptions.fixedSum', 'Fixed sum insured')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={model.partsDepreciation} onCheckedChange={(c) => patch({ partsDepreciation: c === true })} disabled={disabled} />
          {t('insurance_desk.policies.form.coverageOptions.partsDepreciation', 'Parts depreciation')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={model.sumConsumption} onCheckedChange={(c) => patch({ sumConsumption: c === true })} disabled={disabled} />
          {t('insurance_desk.policies.form.coverageOptions.sumConsumption', 'Sum includes wear')}
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t('insurance_desk.policies.form.coverageOptions.deductibleAmount', 'Own share amount')}</Label>
          <input
            className={CRUD_FORM_TEXT_INPUT_CLASS}
            value={model.deductibleAmount}
            onChange={(e) => patch({ deductibleAmount: e.target.value })}
            disabled={disabled}
            data-crud-focus-target=""
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs text-muted-foreground">{t('insurance_desk.policies.form.coverageOptions.vehicleEquipment', 'Non-factory equipment')}</Label>
          <input
            className={CRUD_FORM_TEXT_INPUT_CLASS}
            value={model.vehicleEquipment}
            onChange={(e) => patch({ vehicleEquipment: e.target.value })}
            disabled={disabled}
            data-crud-focus-target=""
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={model.drivingLicenseLessThan2}
            onCheckedChange={(c) => patch({ drivingLicenseLessThan2: c === true })}
            disabled={disabled}
          />
          {t('insurance_desk.policies.form.coverageOptions.licenceUnder2y', 'Main driver: licence held under 2 years')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={model.usingByUnder25} onCheckedChange={(c) => patch({ usingByUnder25: c === true })} disabled={disabled} />
          {t('insurance_desk.policies.form.coverageOptions.under25', 'Regular driver under 25')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={model.isCompany} onCheckedChange={(c) => patch({ isCompany: c === true })} disabled={disabled} />
          {t('insurance_desk.policies.form.coverageOptions.isCompany', 'Company vehicle')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={model.isFundedOwn} onCheckedChange={(c) => patch({ isFundedOwn: c === true })} disabled={disabled} />
          {t('insurance_desk.policies.form.coverageOptions.isFundedOwn', 'Self-funded purchase')}
        </label>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

export default PolicyCoverageOptionsField
