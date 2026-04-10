"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import type { InlineSelectOption } from '@open-mercato/ui/backend/detail'
import { InlineSelectEditor, InlineTextEditor } from '@open-mercato/ui/backend/detail'
import { renderDictionaryIcon } from '@open-mercato/core/modules/dictionaries/components/dictionaryAppearance'
import { EntitySearchCombobox } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import {
  loadActiveInsurerSelectOptions,
  loadInsurerContactOptions,
  searchPartnerEntityOptions,
} from '../../lib/loadPolicyFormOptions'
import { INSURANCE_DESK_BASE } from '../../backend/insurance-desk/paths'

export type PolicyStatusDisplayEntry = {
  value: string
  label: string
  icon?: string
  color?: string
}

type Props = {
  form: Record<string, unknown>
  setForm: React.Dispatch<React.SetStateAction<Record<string, unknown>>>
  persistPolicy: (values: Record<string, unknown>) => Promise<void>
  insurerOptions: InlineSelectOption[]
  partnerOptions: InlineSelectOption[]
  productOptions: InlineSelectOption[]
  caretakerOptions: InlineSelectOption[]
  statusOptions: InlineSelectOption[]
  statusDisplay: PolicyStatusDisplayEntry[]
}

export function PolicyBasicsInlineSection({
  form,
  setForm,
  persistPolicy,
  insurerOptions,
  partnerOptions,
  productOptions,
  caretakerOptions,
  statusOptions,
  statusDisplay,
}: Props) {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const partnerPrefixes = React.useMemo(
    () => ({
      personPrefix: t('insurance_desk.policies.form.partnerKind.person', 'Person'),
      companyPrefix: t('insurance_desk.policies.form.partnerKind.company', 'Company'),
    }),
    [t],
  )
  const emptyLabel = t('insurance_desk.detail.emptyField', '—')
  const noneLabel = t('insurance_desk.policies.form.none', '— none —')
  const pickInsurerFirst = t('insurance_desk.policies.form.insurerContact.pickInsurerFirst', 'Select an insurer first.')

  const insurerId = typeof form.insurerId === 'string' ? form.insurerId.trim() : ''
  const insurerContactId = typeof form.insurerContactId === 'string' ? form.insurerContactId.trim() : ''

  const [insurerContactOptions, setInsurerContactOptions] = React.useState<InlineSelectOption[]>([
    { value: '', label: noneLabel },
  ])

  React.useEffect(() => {
    if (!insurerId.length) {
      setInsurerContactOptions([{ value: '', label: noneLabel }])
      return
    }
    let cancelled = false
    setInsurerContactOptions([{ value: '', label: noneLabel }])
    loadInsurerContactOptions(insurerId, noneLabel)
      .then((opts) => {
        if (cancelled) return
        if (insurerContactId.length > 0 && !opts.some((o) => o.value === insurerContactId)) {
          setInsurerContactOptions([...opts, { value: insurerContactId, label: insurerContactId }])
        } else {
          setInsurerContactOptions(opts)
        }
      })
      .catch(() => {
        if (!cancelled) setInsurerContactOptions([{ value: '', label: noneLabel }])
      })
    return () => {
      cancelled = true
    }
  }, [insurerContactId, insurerId, noneLabel, scopeVersion])

  const mergeAndPersist = React.useCallback(
    async (patch: Record<string, unknown>) => {
      const merged = { ...(form as Record<string, unknown>), ...patch }
      setForm(merged)
      await persistPolicy(merged)
    },
    [form, persistPolicy, setForm],
  )

  const statusByValue = React.useMemo(() => {
    const m = new Map<string, PolicyStatusDisplayEntry>()
    for (const e of statusDisplay) {
      if (e.value.trim().length) m.set(e.value.trim(), e)
    }
    return m
  }, [statusDisplay])

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <InlineTextEditor
        label={t('insurance_desk.policies.form.policyNumber', 'Policy number')}
        value={typeof form.policyNumber === 'string' ? form.policyNumber : ''}
        emptyLabel={emptyLabel}
        onSave={async (next) => {
          const v = (next ?? '').trim()
          if (!v.length) {
            throw new Error('required')
          }
          await mergeAndPersist({ policyNumber: v })
        }}
        variant="muted"
        activateOnClick
      />

      <InlineSelectEditor
        label={t('insurance_desk.policies.form.insurer', 'Insurer')}
        value={typeof form.insurerId === 'string' ? form.insurerId : ''}
        emptyLabel={emptyLabel}
        options={insurerOptions}
        onSave={async (next) => {
          const v = (next ?? '').trim()
          if (!v.length) throw new Error('required')
          await mergeAndPersist({ insurerId: v, insurerContactId: '' })
        }}
        variant="muted"
        activateOnClick
        renderEditor={({ value: draft, onChange }) => (
          <EntitySearchCombobox
            value={draft}
            onChange={onChange}
            options={insurerOptions.map((o) => ({ ...o }))}
            onRemoteSearch={(q) => loadActiveInsurerSelectOptions(q)}
            placeholder={emptyLabel}
            createInNewTabHref={`${INSURANCE_DESK_BASE}/insurers/create`}
            createInNewTabAriaLabel={t('insurance_desk.policies.form.addInsurerInNewTab', 'Add insurer in a new tab')}
          />
        )}
      />

      <InlineSelectEditor
        label={t('insurance_desk.policies.form.insurerContact', 'Insurer contact')}
        value={insurerContactId.length ? insurerContactId : ''}
        emptyLabel={emptyLabel}
        options={insurerContactOptions}
        variant="muted"
        activateOnClick={insurerId.length > 0}
        onSave={async (next) => {
          await mergeAndPersist({ insurerContactId: (next ?? '').trim() })
        }}
        renderDisplay={({ value: v, emptyLabel: el }) => {
          if (!insurerId.length) {
            return <span className="text-sm text-muted-foreground">{pickInsurerFirst}</span>
          }
          const id = (v ?? '').trim()
          if (!id.length) {
            return <span className="text-muted-foreground">{el}</span>
          }
          const hit = insurerContactOptions.find((o) => o.value === id)
          return <span className="font-medium leading-tight">{hit?.label ?? id}</span>
        }}
      />

      <InlineSelectEditor
        label={t('insurance_desk.policies.form.caretaker', 'Caretaker')}
        value={typeof form.caretakerUserId === 'string' ? form.caretakerUserId : ''}
        emptyLabel={emptyLabel}
        options={caretakerOptions}
        onSave={async (next) => {
          const v = (next ?? '').trim()
          if (!v.length) throw new Error('required')
          await mergeAndPersist({ caretakerUserId: v })
        }}
        variant="muted"
        activateOnClick
      />

      <InlineSelectEditor
        label={t('insurance_desk.policies.form.referringPartyEntity', 'Referring party')}
        value={typeof form.referringPartnerEntityId === 'string' ? form.referringPartnerEntityId : ''}
        emptyLabel={emptyLabel}
        options={partnerOptions}
        onSave={async (next) => {
          const v = (next ?? '').trim()
          await mergeAndPersist({ referringPartnerEntityId: v })
        }}
        variant="muted"
        activateOnClick
        renderEditor={({ value: draft, onChange }) => (
          <EntitySearchCombobox
            value={draft}
            onChange={onChange}
            options={partnerOptions.map((o) => ({ ...o }))}
            onRemoteSearch={(q) => searchPartnerEntityOptions(q, partnerPrefixes)}
            placeholder={emptyLabel}
            createInNewTabHref="/backend/customers/companies/create"
            createInNewTabAriaLabel={t(
              'insurance_desk.policies.form.addPartnerInNewTab',
              'Add referring party in a new tab',
            )}
          />
        )}
      />

      <InlineSelectEditor
        label={t('insurance_desk.policies.form.catalogProduct', 'Catalog product')}
        value={typeof form.catalogProductId === 'string' ? form.catalogProductId : ''}
        emptyLabel={emptyLabel}
        options={productOptions}
        onSave={async (next) => mergeAndPersist({ catalogProductId: (next ?? '').trim() })}
        variant="muted"
        activateOnClick
      />

      <InlineTextEditor
        label={t('insurance_desk.policies.form.validFrom', 'Valid from')}
        value={typeof form.validFrom === 'string' ? form.validFrom : ''}
        emptyLabel={emptyLabel}
        inputType="date"
        onSave={async (next) => mergeAndPersist({ validFrom: (next ?? '').trim() })}
        variant="muted"
        activateOnClick
      />

      <InlineTextEditor
        label={t('insurance_desk.policies.form.validTo', 'Valid to')}
        value={typeof form.validTo === 'string' ? form.validTo : ''}
        emptyLabel={emptyLabel}
        inputType="date"
        onSave={async (next) => mergeAndPersist({ validTo: (next ?? '').trim() })}
        variant="muted"
        activateOnClick
      />

      <InlineSelectEditor
        label={t('insurance_desk.policies.form.status', 'Status')}
        value={typeof form.status === 'string' ? form.status : ''}
        emptyLabel={noneLabel}
        options={statusOptions.filter((o) => o.value.trim().length > 0)}
        onSave={async (next) => {
          const v = (next ?? '').trim()
          if (!v.length) throw new Error('required')
          await mergeAndPersist({ status: v })
        }}
        variant="muted"
        activateOnClick
        renderDisplay={({ value: v, emptyLabel: el }) => {
          const raw = v?.trim() ?? ''
          if (!raw.length) {
            return <span className="text-muted-foreground">{el}</span>
          }
          const meta = statusByValue.get(raw)
          const label = meta?.label ?? statusOptions.find((o) => o.value === raw)?.label ?? raw
          const icon = meta?.icon?.trim()
          const color = meta?.color?.trim()
          return (
            <span className="inline-flex items-center gap-2">
              {icon ? (
                <span className="shrink-0 text-muted-foreground">{renderDictionaryIcon(icon, 'h-4 w-4')}</span>
              ) : null}
              {color ? (
                <span
                  className="inline-block size-2.5 shrink-0 rounded-full border border-border"
                  style={{ backgroundColor: color }}
                />
              ) : null}
              <span className="font-medium leading-tight">{label}</span>
            </span>
          )
        }}
      />
    </div>
  )
}
