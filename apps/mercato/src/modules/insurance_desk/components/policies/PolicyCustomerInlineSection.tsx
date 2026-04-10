"use client"

import * as React from 'react'
import type { TranslateFn } from '@open-mercato/shared/lib/i18n/context'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import {
  CustomerEntitySinglePicker,
  type CustomerEntitySinglePickerLabels,
} from '@open-mercato/core/modules/customers/components/formConfig'
import { PreviewFieldCell, PreviewFieldGrid } from '../leads/leadDetailPreviewUtils'
import { fetchPartnerLabelsByIds } from '../../lib/policyListLookups'

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

  return (
    <PreviewFieldGrid className="sm:grid-cols-2">
      <PreviewFieldCell
        label={t('insurance_desk.policies.detail.customer.company', 'Company')}
        value={show(companyLabel)}
      />
      <PreviewFieldCell
        label={t('insurance_desk.policies.detail.customer.person', 'Person')}
        value={show(personLabel)}
      />
    </PreviewFieldGrid>
  )
}

type Props = {
  form: Record<string, unknown>
  setForm: React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>
}

export function PolicyCustomerInlineSection({ form, setForm }: Props) {
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

  const personId = typeof form.insuredPersonEntityId === 'string' ? form.insuredPersonEntityId.trim() : ''
  const companyId = typeof form.insuredCompanyEntityId === 'string' ? form.insuredCompanyEntityId.trim() : ''

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
              setForm((prev) =>
                prev ? { ...prev, insuredCompanyEntityId: trimmed.length ? trimmed : '' } : prev,
              )
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
            onChange={(next) => {
              const trimmed = (next ?? '').trim()
              setForm((prev) =>
                prev ? { ...prev, insuredPersonEntityId: trimmed.length ? trimmed : '' } : prev,
              )
            }}
          />
        </div>
      </div>
    </div>
  )
}
