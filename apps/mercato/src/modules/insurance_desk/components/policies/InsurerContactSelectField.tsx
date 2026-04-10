"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import type { CrudCustomFieldRenderProps } from '@open-mercato/ui/backend/CrudForm'
import { EntitySearchCombobox } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import { cn } from '@open-mercato/shared/lib/utils'
import { loadInsurerContactOptions } from '../../lib/loadPolicyFormOptions'
import { INSURANCE_DESK_BASE } from '../../backend/insurance-desk/paths'

export function InsurerContactSelectField(props: CrudCustomFieldRenderProps) {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const { value, setValue, values, disabled, error: fieldError } = props
  const insurerId = typeof values?.insurerId === 'string' ? values.insurerId.trim() : ''
  const valueRef = React.useRef(value)
  valueRef.current = value

  const noneLabel = t('insurance_desk.policies.form.none', '— none —')
  const pickInsurerFirst = t('insurance_desk.policies.form.insurerContact.pickInsurerFirst', 'Select an insurer first.')

  const [options, setOptions] = React.useState<Array<{ value: string; label: string }>>([{ value: '', label: noneLabel }])
  const [loading, setLoading] = React.useState(false)

  const prevInsurerRef = React.useRef<string | undefined>(undefined)
  React.useEffect(() => {
    if (prevInsurerRef.current === undefined) {
      prevInsurerRef.current = insurerId
      return
    }
    if (prevInsurerRef.current !== insurerId) {
      prevInsurerRef.current = insurerId
      setValue('')
    }
  }, [insurerId, setValue])

  React.useEffect(() => {
    if (!insurerId.length) {
      setOptions([{ value: '', label: noneLabel }])
      return
    }
    let cancelled = false
    setLoading(true)
    loadInsurerContactOptions(insurerId, noneLabel)
      .then((opts) => {
        if (cancelled) return
        setOptions(opts)
        const selected = valueRef.current == null ? '' : String(valueRef.current).trim()
        if (selected.length > 0 && !opts.some((o) => o.value === selected)) {
          setValue('')
        }
      })
      .catch(() => {
        if (!cancelled) setOptions([{ value: '', label: noneLabel }])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [insurerId, noneLabel, scopeVersion, setValue])

  const stringValue = value == null ? '' : String(value)
  const selectDisabled = disabled || !insurerId.length || loading

  const mergedOptions = React.useMemo(() => {
    if (!stringValue.length) return options
    if (options.some((o) => o.value === stringValue)) return options
    return [...options, { value: stringValue, label: stringValue }]
  }, [options, stringValue])

  const manageHref = insurerId.length ? `${INSURANCE_DESK_BASE}/insurers/${encodeURIComponent(insurerId)}` : null

  return (
    <div className={cn('space-y-1.5', fieldError && 'rounded-md border border-destructive/50 p-2')}>
      <EntitySearchCombobox
        value={stringValue}
        onChange={(next) => setValue(next)}
        options={mergedOptions}
        placeholder={noneLabel}
        disabled={selectDisabled}
        createInNewTabHref={manageHref}
        createInNewTabAriaLabel={t(
          'insurance_desk.policies.form.insurerContact.manageInNewTab',
          'Open insurer to add or edit contacts',
        )}
      />
      {!insurerId.length ? (
        <p className="text-xs text-muted-foreground">{pickInsurerFirst}</p>
      ) : null}
      {loading && insurerId.length > 0 ? (
        <p className="text-xs text-muted-foreground">{t('common.loading', 'Loading…')}</p>
      ) : null}
    </div>
  )
}

export default InsurerContactSelectField
