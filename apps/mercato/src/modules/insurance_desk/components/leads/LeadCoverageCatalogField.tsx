"use client"

import * as React from 'react'
import Link from 'next/link'
import { Check, Settings } from 'lucide-react'
import {
  CRUD_FORM_SELECT_CLASS,
  CRUD_FORM_TEXT_INPUT_CLASS,
  type CrudCustomFieldRenderProps,
} from '@open-mercato/ui/backend/CrudForm'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { IconButton } from '@open-mercato/ui/primitives/icon-button'
import { Label } from '@open-mercato/ui/primitives/label'
import { Checkbox } from '@open-mercato/ui/primitives/checkbox'
import { cn } from '@open-mercato/shared/lib/utils'
import { Separator } from '@open-mercato/ui/primitives/separator'
import { INSURANCE_CONFIG_INSURANCES_PATH } from '../../backend/insurance-desk/paths'
import { ProtectionCatalogLucideIcon } from '../../lib/catalogLucideIcon'
import {
  normalizeCoveragesValue,
  type PolicyCoverageKey,
  type PolicyCoverageLine,
  type PolicyCoveragesFormValue,
  POLICY_COVERAGE_KEYS,
} from '../policies/PolicyCoveragesField'

const OFF_COVERAGE_LINE: PolicyCoverageLine = {
  enabled: false,
  sumInsured: '',
  deductible: '',
  notes: '',
}

type ProtectionCatalogEntry = {
  value: string
  label: string
  description: string
  icon?: string
  mapsToCoverageKey?: string
  additionalOptionsLabel?: string
  additionalOptions: Array<{ value: string; name: string }>
  fields: Array<{
    id: string
    label: string
    propertyKey: string
    type: 'text' | 'number' | 'currency' | 'checkbox'
    required?: boolean
  }>
}

type ProtectionCatalog = { options: ProtectionCatalogEntry[] }

function isCoverageKey(s: string): s is PolicyCoverageKey {
  return (POLICY_COVERAGE_KEYS as readonly string[]).includes(s)
}

function resolveCoverageKey(entry: ProtectionCatalogEntry): PolicyCoverageKey | null {
  const raw = entry.mapsToCoverageKey?.trim().length ? entry.mapsToCoverageKey : entry.value
  return isCoverageKey(raw) ? raw : null
}

export function LeadCoverageCatalogField(
  props: CrudCustomFieldRenderProps & {
    omitSectionHeading?: boolean
    /** Lead inquiries omit catalog detail fields; policy forms show them under "Scope settings — …". */
    catalogMode?: 'lead' | 'policy'
  },
) {
  const t = useT()
  const catalogMode = props.catalogMode ?? 'lead'
  const { value, setValue, setFormValue, disabled, error, values, omitSectionHeading } = props
  const [catalog, setCatalog] = React.useState<ProtectionCatalog | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      const call = await apiCall<ProtectionCatalog>('/api/insurance/config-protection-catalog')
      if (cancelled) return
      if (!call.ok || !call.result?.options) {
        setLoadError(t('insurance_desk.leads.coverage.catalogError', 'Could not load protection catalog.'))
        setCatalog(null)
        return
      }
      setLoadError(null)
      setCatalog(call.result)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [t])

  const coverages = normalizeCoveragesValue(value)
  const subs =
    values?.coverageSubSelections && typeof values.coverageSubSelections === 'object'
      ? (values.coverageSubSelections as Record<string, string>)
      : {}
  const details =
    values?.coverageDetailValues && typeof values.coverageDetailValues === 'object'
      ? (values.coverageDetailValues as Record<string, Record<string, unknown>>)
      : {}

  const patchCoverage = React.useCallback(
    (key: PolicyCoverageKey, partial: Partial<PolicyCoveragesFormValue[PolicyCoverageKey]>) => {
      const current = normalizeCoveragesValue(value)
      setValue({
        ...current,
        [key]: { ...current[key], ...partial },
      })
    },
    [setValue, value],
  )

  const setSub = React.useCallback(
    (catalogValue: string, opt: string) => {
      setFormValue?.('coverageSubSelections', { ...subs, [catalogValue]: opt })
    },
    [setFormValue, subs],
  )

  const setDetail = React.useCallback(
    (catalogValue: string, propertyKey: string, v: unknown) => {
      const prev = details[catalogValue] ?? {}
      setFormValue?.('coverageDetailValues', {
        ...details,
        [catalogValue]: { ...prev, [propertyKey]: v },
      })
    },
    [setFormValue, details],
  )

  const sectionHeading = (
    <div className="flex w-full min-w-0 items-start justify-between gap-3">
      <h3 className="text-sm font-medium leading-tight">
        {t('insurance_desk.leads.form.groups.coverageScope', 'Coverage scope')}
      </h3>
      <IconButton
        variant="outline"
        size="sm"
        type="button"
        asChild
        className="shrink-0"
        aria-label={t(
          'insurance_desk.leads.coverage.configureCatalogAria',
          'Configure protection catalog',
        )}
      >
        <Link href={INSURANCE_CONFIG_INSURANCES_PATH}>
          <Settings className="size-4" />
        </Link>
      </IconButton>
    </div>
  )

  if (loadError || !catalog) {
    return (
      <div className="space-y-3">
        {!omitSectionHeading ? sectionHeading : null}
        <p className="text-sm text-muted-foreground">
          {loadError ?? t('common.loading', 'Loading…')}
        </p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', error && 'rounded-md border border-destructive/50 p-3')}>
      {!omitSectionHeading ? sectionHeading : (
        <div className="flex justify-end">
          <IconButton variant="outline" size="sm" type="button" asChild className="shrink-0" aria-label={t(
            'insurance_desk.leads.coverage.configureCatalogAria',
            'Configure protection catalog',
          )}>
            <Link href={INSURANCE_CONFIG_INSURANCES_PATH}>
              <Settings className="size-4" />
            </Link>
          </IconButton>
        </div>
      )}
      {catalog.options.map((entry) => {
        const covKey = resolveCoverageKey(entry)
        if (!covKey) return null
        const line = coverages[covKey] ?? OFF_COVERAGE_LINE
        const isActive = line.enabled
        const hasAdditionalOptions = isActive && entry.additionalOptions.length > 0
        const showPolicyDetailFields = isActive && catalogMode === 'policy' && entry.fields.length > 0

        return (
          <div key={entry.value} className="space-y-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => patchCoverage(covKey, { enabled: !isActive })}
              className={cn(
                'relative flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors',
                isActive ? 'border-primary bg-accent/35' : 'border-border bg-background hover:bg-muted/40',
              )}
            >
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
                  isActive ? 'bg-primary/10' : 'bg-muted',
                )}
              >
                <ProtectionCatalogLucideIcon
                  name={entry.icon}
                  className={cn('h-5 w-5', isActive ? 'text-primary' : 'text-muted-foreground')}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm font-medium', isActive ? 'text-primary' : 'text-foreground')}>
                  {entry.label}
                </p>
                <p className="text-xs text-muted-foreground">{entry.description}</p>
              </div>
              <div
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                  isActive ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                )}
              >
                {isActive ? <Check className="h-3 w-3 text-white" /> : null}
              </div>
            </button>
            {hasAdditionalOptions ? (
              <div className="ml-0 space-y-2 pl-1 sm:ml-4">
                {entry.additionalOptionsLabel ? (
                  <Label className="text-xs">{entry.additionalOptionsLabel}</Label>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {entry.additionalOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={disabled}
                      onClick={() => setSub(entry.value, opt.value)}
                      className={cn(
                        'rounded-md border px-3 py-1.5 text-sm transition-colors',
                        subs[entry.value] === opt.value
                          ? 'border-primary bg-accent/35 text-foreground'
                          : 'border-border bg-background hover:bg-muted/50',
                      )}
                    >
                      {opt.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {showPolicyDetailFields ? (
              <div
                className={cn(
                  'ml-0 space-y-3 pl-1 sm:ml-4',
                  hasAdditionalOptions ? 'mt-3 border-t border-border pt-4' : 'mt-2',
                )}
              >
                <h4 className="text-sm font-medium leading-snug text-foreground">
                  {t('insurance_desk.policies.coverage.scopeSettingsPrefix', 'Scope settings - ')}
                  {entry.label}
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {entry.fields.map((field) => {
                    const store = details[entry.value] ?? {}
                    const cur = store[field.propertyKey]
                    const key = `${entry.value}-${field.id}`
                    if (field.type === 'checkbox') {
                      return (
                        <label key={field.id} className="flex items-center gap-2 text-sm sm:col-span-2">
                          <Checkbox
                            checked={cur === true}
                            onCheckedChange={(c) => setDetail(entry.value, field.propertyKey, c === true)}
                            disabled={disabled}
                          />
                          {field.label}
                        </label>
                      )
                    }
                    if (field.type === 'currency') {
                      const amount =
                        typeof cur === 'object' && cur && 'amount' in (cur as object)
                          ? String((cur as { amount?: unknown }).amount ?? '')
                          : ''
                      const ccy =
                        typeof cur === 'object' && cur && 'currency' in (cur as object)
                          ? String((cur as { currency?: unknown }).currency ?? 'PLN')
                          : 'PLN'
                      return (
                        <div key={field.id} className="space-y-1.5 sm:col-span-2">
                          <Label className="text-xs">{field.label}</Label>
                          <div className="flex gap-2">
                            <input
                              className={cn(CRUD_FORM_TEXT_INPUT_CLASS, 'min-w-0 flex-1')}
                              inputMode="decimal"
                              value={amount}
                              onChange={(e) =>
                                setDetail(entry.value, field.propertyKey, { amount: e.target.value, currency: ccy })
                              }
                              disabled={disabled}
                              data-crud-focus-target=""
                            />
                            <select
                              className={cn(CRUD_FORM_SELECT_CLASS, 'w-auto min-w-[4.5rem] shrink-0')}
                              value={ccy}
                              onChange={(e) =>
                                setDetail(entry.value, field.propertyKey, { amount, currency: e.target.value })
                              }
                              disabled={disabled}
                            >
                              <option value="PLN">PLN</option>
                              <option value="EUR">EUR</option>
                              <option value="USD">USD</option>
                            </select>
                          </div>
                        </div>
                      )
                    }
                    return (
                      <div key={field.id} className="space-y-1.5">
                        <Label htmlFor={key} className="text-xs">
                          {field.label}
                          {field.required ? ' *' : ''}
                        </Label>
                        <input
                          id={key}
                          className={CRUD_FORM_TEXT_INPUT_CLASS}
                          type={field.type === 'number' ? 'number' : 'text'}
                          value={typeof cur === 'string' || typeof cur === 'number' ? String(cur) : ''}
                          onChange={(e) =>
                            setDetail(
                              entry.value,
                              field.propertyKey,
                              field.type === 'number' ? e.target.value : e.target.value,
                            )
                          }
                          disabled={disabled}
                          data-crud-focus-target=""
                        />
                      </div>
                    )
                  })}
                </div>
                <Separator className="bg-border" />
              </div>
            ) : null}
          </div>
        )
      })}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

export default LeadCoverageCatalogField
