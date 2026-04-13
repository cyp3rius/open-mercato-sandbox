"use client"

import * as React from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import type { TranslateFn } from '@open-mercato/shared/lib/i18n/context'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import {
  CustomerEntitySinglePicker,
  type CustomerEntitySinglePickerLabels,
} from '@open-mercato/core/modules/customers/components/formConfig'
import { PreviewFieldCell } from '../leads/leadDetailPreviewUtils'
import { fetchPartnerLabelsByIds } from '../../lib/policyListLookups'

function CustomerEntityPreviewTile(props: {
  entityId: string
  fieldLabel: string
  value: React.ReactNode
  recordHref: string | null
  t: TranslateFn
}) {
  const { entityId, fieldLabel, value, recordHref, t } = props
  const showOpen = Boolean(recordHref && entityId.trim().length > 0)
  return (
    <div className="relative rounded-md border border-border/60 bg-background/80 px-3 py-3 text-sm">
      {showOpen ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          asChild
          className="absolute end-3 top-3 z-10 shrink-0"
        >
          <Link
            href={recordHref!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2"
          >
            <ExternalLink className="size-4 shrink-0" aria-hidden />
            {t('common.open', 'Open')}
          </Link>
        </Button>
      ) : null}
      <div className={showOpen ? 'pe-28' : undefined}>
        <PreviewFieldCell label={fieldLabel} value={value} />
      </div>
    </div>
  )
}

export function PolicyCustomerDetailPreview(props: {
  companyId: string
  personId: string
  t: TranslateFn
}) {
  const { companyId, personId, t } = props
  const [companyLabel, setCompanyLabel] = React.useState<string | null>(null)
  const [personLabel, setPersonLabel] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    const ids = [companyId, personId].filter((x) => x.trim().length > 0)
    if (!ids.length) {
      setCompanyLabel('')
      setPersonLabel('')
      setLoading(false)
      return
    }
    setLoading(true)
    void fetchPartnerLabelsByIds(ids).then((map) => {
      if (cancelled) return
      setCompanyLabel(companyId.trim().length ? map.get(companyId) ?? companyId : '')
      setPersonLabel(personId.trim().length ? map.get(personId) ?? personId : '')
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [companyId, personId])

  const show = (raw: string | null) => {
    if (loading) return t('common.loading', 'Loading…')
    if (raw === null) return ''
    return raw
  }

  const companyTrim = companyId.trim()
  const personTrim = personId.trim()
  const companyHref =
    companyTrim.length > 0
      ? `/backend/customers/companies-v2/${encodeURIComponent(companyTrim)}`
      : null
  const personHref =
    personTrim.length > 0 ? `/backend/customers/people-v2/${encodeURIComponent(personTrim)}` : null

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <CustomerEntityPreviewTile
        entityId={companyId}
        fieldLabel={t('insurance_desk.policies.detail.customer.company', 'Company')}
        value={show(companyLabel)}
        recordHref={companyHref}
        t={t}
      />
      <CustomerEntityPreviewTile
        entityId={personId}
        fieldLabel={t('insurance_desk.policies.detail.customer.person', 'Person')}
        value={show(personLabel)}
        recordHref={personHref}
        t={t}
      />
    </div>
  )
}

type RecordModeProps = {
  mode: 'record'
  form: Record<string, unknown>
  setForm: React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>
}

type CrudModeProps = {
  mode: 'crud'
  values: Record<string, unknown>
  setFormValue: (id: string, value: unknown) => void
}

export type PolicyCustomerInlineSectionProps = RecordModeProps | CrudModeProps

function sliceForm(props: PolicyCustomerInlineSectionProps): Record<string, unknown> {
  return props.mode === 'record' ? props.form : props.values
}

export function PolicyCustomerInlineSection(props: PolicyCustomerInlineSectionProps) {
  const t = useT()

  const companyLabels = React.useMemo<CustomerEntitySinglePickerLabels>(
    () => ({
      searchPlaceholder: t('customers.deals.form.companies.searchPlaceholder', 'Search companies…'),
      loadingLabel: t('customers.deals.form.companies.loading', 'Searching companies…'),
      noResultsLabel: t('customers.deals.form.companies.noResults', 'No companies match your search.'),
      errorLabel: t('customers.deals.form.companies.error', 'Failed to load companies.'),
      addLabel: t('customers.people.form.company.add', 'Add company'),
      companyDialogTitle: t('customers.people.form.company.dialogTitle', 'Add company'),
      companyDialogDescription: t('customers.people.form.company.prompt', 'Enter a new company name'),
      companyNameLabel: t('customers.people.form.company.inputLabel', 'Company name'),
      companyNamePlaceholder: t('customers.people.form.company.inputPlaceholder', 'Acme Corporation'),
      personDialogTitle: t('customers.people.create.title', 'Create person'),
      personDialogDescription: undefined,
      personFirstNameLabel: t('customers.people.form.firstName', 'First name'),
      personLastNameLabel: t('customers.people.form.lastName', 'Last name'),
      cancelLabel: t('customers.people.form.dictionary.cancel', 'Cancel'),
      saveLabel: t('customers.people.form.dictionary.save', 'Save'),
      emptyError: t('customers.people.form.dictionary.errorRequired', 'Please enter a name'),
      errorSave: t('customers.people.form.dictionary.error', 'Failed to save option'),
      removeSelectionAria: t('customers.deals.form.assignees.remove', 'Remove'),
    }),
    [t],
  )

  const personLabels = React.useMemo<CustomerEntitySinglePickerLabels>(
    () => ({
      searchPlaceholder: t('customers.deals.form.people.searchPlaceholder', 'Search people…'),
      loadingLabel: t('customers.deals.form.people.loading', 'Searching people…'),
      noResultsLabel: t('customers.deals.form.people.noResults', 'No people match your search.'),
      errorLabel: t('customers.deals.form.people.error', 'Failed to load people.'),
      addLabel: t('customers.people.create.title', 'Create person'),
      companyDialogTitle: t('customers.people.form.company.dialogTitle', 'Add company'),
      companyDialogDescription: undefined,
      companyNameLabel: t('customers.people.form.company.inputLabel', 'Company name'),
      companyNamePlaceholder: t('customers.people.form.company.inputPlaceholder', 'Acme Corporation'),
      personDialogTitle: t('customers.people.create.title', 'Create person'),
      personDialogDescription: undefined,
      personFirstNameLabel: t('customers.people.form.firstName', 'First name'),
      personLastNameLabel: t('customers.people.form.lastName', 'Last name'),
      cancelLabel: t('customers.people.form.dictionary.cancel', 'Cancel'),
      saveLabel: t('customers.people.form.dictionary.save', 'Save'),
      emptyError: t('insurance_desk.policies.detail.customer.personQuickCreateBothNames', 'Enter first and last name.'),
      errorSave: t('customers.people.form.dictionary.error', 'Failed to save option'),
      removeSelectionAria: t('customers.deals.form.assignees.remove', 'Remove'),
    }),
    [t],
  )

  const formSlice = sliceForm(props)
  const personId =
    typeof formSlice.insuredPersonEntityId === 'string' ? formSlice.insuredPersonEntityId.trim() : ''
  const companyId =
    typeof formSlice.insuredCompanyEntityId === 'string' ? formSlice.insuredCompanyEntityId.trim() : ''

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <div className="text-sm font-medium text-muted-foreground">
            {t('insurance_desk.policies.detail.customer.company', 'Company')}
          </div>
          <CustomerEntitySinglePicker
            kind="company"
            value={companyId.length ? companyId : undefined}
            labels={companyLabels}
            onChange={(next) => {
              const trimmed = (next ?? '').trim()
              const val = trimmed.length ? trimmed : ''
              const shouldClearPerson = val.length > 0 && val !== companyId
              if (props.mode === 'record') {
                props.setForm((prev) =>
                  prev
                    ? {
                        ...prev,
                        insuredCompanyEntityId: val,
                        ...(shouldClearPerson ? { insuredPersonEntityId: '' } : {}),
                      }
                    : prev,
                )
              } else {
                props.setFormValue('insuredCompanyEntityId', val)
                if (shouldClearPerson) props.setFormValue('insuredPersonEntityId', '')
              }
            }}
          />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-muted-foreground">
            {t('insurance_desk.policies.detail.customer.person', 'Person')}
          </div>
          <CustomerEntitySinglePicker
            kind="person"
            value={personId.length ? personId : undefined}
            labels={personLabels}
            restrictPersonToCompanyEntityId={companyId.length ? companyId : null}
            onChange={(next) => {
              const trimmed = (next ?? '').trim()
              const val = trimmed.length ? trimmed : ''
              if (props.mode === 'record') {
                props.setForm((prev) =>
                  prev ? { ...prev, insuredPersonEntityId: val } : prev,
                )
              } else {
                props.setFormValue('insuredPersonEntityId', val)
              }
            }}
          />
        </div>
      </div>
    </div>
  )
}
