"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { CrudCustomFieldRenderProps } from '@open-mercato/ui/backend/CrudForm'
import { Checkbox } from '@open-mercato/ui/primitives/checkbox'
import { Label } from '@open-mercato/ui/primitives/label'
import { cn } from '@open-mercato/shared/lib/utils'
import { CRUD_FORM_TEXT_INPUT_CLASS } from '@open-mercato/ui/backend/CrudForm'

export const POLICY_COVERAGE_KEYS = [
  'OC',
  'AC',
  'NNW',
  'ASSISTANCE',
  'GLASS',
  'DISCOUNT',
  'FOIL',
  'THEFT',
  'GREEN_CARD',
] as const
export type PolicyCoverageKey = (typeof POLICY_COVERAGE_KEYS)[number]

export type PolicyCoverageLine = {
  enabled: boolean
  sumInsured: string
  deductible: string
  notes: string
}

export type PolicyCoveragesFormValue = Record<PolicyCoverageKey, PolicyCoverageLine>

export function emptyPolicyCoveragesValue(): PolicyCoveragesFormValue {
  const line = (): PolicyCoverageLine => ({
    enabled: false,
    sumInsured: '',
    deductible: '',
    notes: '',
  })
  return Object.fromEntries(POLICY_COVERAGE_KEYS.map((key) => [key, line()])) as PolicyCoveragesFormValue
}

export function normalizeCoveragesValue(raw: unknown): PolicyCoveragesFormValue {
  const base = emptyPolicyCoveragesValue()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Partial<Record<PolicyCoverageKey, unknown>>
  for (const key of POLICY_COVERAGE_KEYS) {
    const line = o[key]
    if (!line || typeof line !== 'object') continue
    const l = line as Record<string, unknown>
    const sumStr =
      typeof l.sumInsured === 'number' && Number.isFinite(l.sumInsured)
        ? String(l.sumInsured)
        : typeof l.sumInsured === 'string'
          ? l.sumInsured
          : ''
    const dedStr = typeof l.deductible === 'string' ? l.deductible : l.deductible != null ? String(l.deductible) : ''
    const notesStr = typeof l.notes === 'string' ? l.notes : ''
    const enabledFlag = l.enabled === true
    const hasContent =
      enabledFlag || sumStr.length > 0 || dedStr.length > 0 || notesStr.length > 0
    base[key] = {
      enabled: hasContent,
      sumInsured: sumStr,
      deductible: dedStr,
      notes: notesStr,
    }
  }
  return base
}

export function buildPolicyCoveragesMetadata(v: PolicyCoveragesFormValue | unknown): Record<string, unknown> {
  const normalized = normalizeCoveragesValue(v)
  const out: Record<string, unknown> = {}
  for (const key of POLICY_COVERAGE_KEYS) {
    const line = normalized[key]
    if (!line.enabled) continue
    const sum = line.sumInsured.trim()
    const ded = line.deductible.trim()
    const notes = line.notes.trim()
    const sumNum = sum.length ? Number(sum) : NaN
    out[key] = {
      enabled: true,
      sumInsured: !Number.isNaN(sumNum) ? sumNum : null,
      deductible: ded.length ? ded : null,
      notes: notes.length ? notes : null,
    }
  }
  return out
}

const COVERAGE_LABEL_KEYS: Record<PolicyCoverageKey, string> = {
  OC: 'insurance_desk.policies.form.coverages.OC',
  AC: 'insurance_desk.policies.form.coverages.AC',
  NNW: 'insurance_desk.policies.form.coverages.NNW',
  ASSISTANCE: 'insurance_desk.policies.form.coverages.ASSISTANCE',
  GLASS: 'insurance_desk.policies.form.coverages.GLASS',
  DISCOUNT: 'insurance_desk.policies.form.coverages.DISCOUNT',
  FOIL: 'insurance_desk.policies.form.coverages.FOIL',
  THEFT: 'insurance_desk.policies.form.coverages.THEFT',
  GREEN_CARD: 'insurance_desk.policies.form.coverages.GREEN_CARD',
}

const COVERAGE_FALLBACK: Record<PolicyCoverageKey, string> = {
  OC: 'OC (third-party liability)',
  AC: 'AC (casco)',
  NNW: 'NNW (personal accident)',
  ASSISTANCE: 'Assistance',
  GLASS: 'Glass (szyby)',
  DISCOUNT: 'Discount retention',
  FOIL: 'PPF / window tint',
  THEFT: 'Theft (kradzież)',
  GREEN_CARD: 'Green Card (ZK)',
}

export function PolicyCoveragesField(props: CrudCustomFieldRenderProps) {
  const t = useT()
  const { value, setValue, disabled, error } = props
  const model = normalizeCoveragesValue(value)

  const patch = React.useCallback(
    (key: PolicyCoverageKey, partial: Partial<PolicyCoverageLine>) => {
      const current = normalizeCoveragesValue(value)
      const next: PolicyCoveragesFormValue = {
        ...current,
        [key]: { ...current[key], ...partial },
      }
      setValue(next)
    },
    [setValue, value],
  )

  return (
    <div className={cn('space-y-4', error && 'rounded-md border border-destructive/50 p-3')}>
      <p className="text-sm font-medium text-foreground">
        {t('insurance_desk.policies.form.coverages.intro', 'Select coverage types and configure limits.')}
      </p>
      {POLICY_COVERAGE_KEYS.map((key) => {
        const line = model[key]
        const label = t(COVERAGE_LABEL_KEYS[key], COVERAGE_FALLBACK[key])
        return (
          <div
            key={key}
            className="rounded-md border border-border bg-muted/20 p-3 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Checkbox
                id={`coverage-${key}`}
                checked={line.enabled}
                onCheckedChange={(c) => patch(key, { enabled: c === true })}
                disabled={disabled}
              />
              <Label htmlFor={`coverage-${key}`} className="cursor-pointer font-medium">
                {label}
              </Label>
            </div>
            {line.enabled ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {t('insurance_desk.policies.form.coverages.sumInsured', 'Sum insured')}
                  </Label>
                  <input
                    className={CRUD_FORM_TEXT_INPUT_CLASS}
                    type="text"
                    inputMode="decimal"
                    value={line.sumInsured}
                    onChange={(e) => patch(key, { sumInsured: e.target.value })}
                    disabled={disabled}
                    placeholder={t('insurance_desk.policies.form.coverages.sumPlaceholder', 'e.g. 500000')}
                    data-crud-focus-target=""
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {t('insurance_desk.policies.form.coverages.deductible', 'Deductible')}
                  </Label>
                  <input
                    className={CRUD_FORM_TEXT_INPUT_CLASS}
                    type="text"
                    value={line.deductible}
                    onChange={(e) => patch(key, { deductible: e.target.value })}
                    disabled={disabled}
                    placeholder={t('insurance_desk.policies.form.coverages.deductiblePlaceholder', 'e.g. 500 PLN')}
                    data-crud-focus-target=""
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">
                    {t('insurance_desk.policies.form.coverages.notes', 'Notes')}
                  </Label>
                  <input
                    className={CRUD_FORM_TEXT_INPUT_CLASS}
                    type="text"
                    value={line.notes}
                    onChange={(e) => patch(key, { notes: e.target.value })}
                    disabled={disabled}
                    placeholder={t('insurance_desk.policies.form.coverages.notesPlaceholder', 'Optional details')}
                    data-crud-focus-target=""
                  />
                </div>
              </div>
            ) : null}
          </div>
        )
      })}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

export default PolicyCoveragesField
