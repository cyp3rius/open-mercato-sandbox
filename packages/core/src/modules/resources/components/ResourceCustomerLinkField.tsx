"use client"

import * as React from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import type { TranslateFn } from '@open-mercato/shared/lib/i18n/context'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import {
  CustomerEntitySinglePicker,
  type CustomerEntitySinglePickerLabels,
} from '@open-mercato/core/modules/customers/components/formConfig'

type LinkedKind = 'person' | 'company' | null

type PendingPick = { id: string; kind: 'person' | 'company' }

type PreviewState = {
  kind: 'person' | 'company' | 'unknown'
  title: string
  subtitle: string | null
  recordHref: string
}

function ResourceCustomerPreviewTile(props: {
  fieldLabel: string
  recordHref: string | null
  showOpen: boolean
  children: React.ReactNode
  t: TranslateFn
}) {
  const { fieldLabel, recordHref, showOpen, children, t } = props
  return (
    <div className="relative rounded-md border border-border/60 bg-background/80 px-3 py-3 text-sm">
      {showOpen && recordHref ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          asChild
          className="absolute end-3 top-3 z-10 shrink-0"
        >
          <Link
            href={recordHref}
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
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{fieldLabel}</div>
        <div className="mt-2 min-h-10">{children}</div>
      </div>
    </div>
  )
}

export function ResourceCustomerLinkField({
  value,
  onChange,
  disabled,
}: {
  value: string | null | undefined
  onChange: (next: string | null) => void
  disabled?: boolean
}) {
  const t = useT()
  const normalizedValue = typeof value === 'string' && value.trim().length ? value.trim() : null

  const [entityKind, setEntityKind] = React.useState<LinkedKind>(null)
  const [kindResolving, setKindResolving] = React.useState(false)
  const [preview, setPreview] = React.useState<PreviewState | null>(null)
  const [pendingPick, setPendingPick] = React.useState<PendingPick | null>(null)

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

  React.useEffect(() => {
    if (!normalizedValue) {
      setEntityKind(null)
      setPreview(null)
      setKindResolving(false)
      setPendingPick(null)
      return
    }
    setPendingPick((p) => (p && p.id !== normalizedValue ? null : p))
    setEntityKind(null)
    setPreview(null)
    setKindResolving(true)
    let cancelled = false
    ;(async () => {
      try {
        const personRes = await apiCall<{
          person?: { id?: string; displayName?: string | null; primaryEmail?: string | null }
        }>(`/api/customers/people/${encodeURIComponent(normalizedValue)}`)
        if (cancelled) return
        if (personRes.ok && personRes.result?.person?.id === normalizedValue) {
          const row = personRes.result.person
          const title =
            typeof row.displayName === 'string' && row.displayName.trim().length
              ? row.displayName.trim()
              : normalizedValue
          const email =
            typeof row.primaryEmail === 'string' && row.primaryEmail.trim().length
              ? row.primaryEmail.trim()
              : null
          setEntityKind('person')
          setPreview({
            kind: 'person',
            title,
            subtitle: email,
            recordHref: `/backend/customers/people-v2/${encodeURIComponent(normalizedValue)}`,
          })
          return
        }
        const companyRes = await apiCall<{
          company?: { id?: string; displayName?: string | null; primaryEmail?: string | null }
          profile?: { domain?: string | null } | null
        }>(`/api/customers/companies/${encodeURIComponent(normalizedValue)}`)
        if (cancelled) return
        if (companyRes.ok && companyRes.result?.company?.id === normalizedValue) {
          const row = companyRes.result.company
          const title =
            typeof row.displayName === 'string' && row.displayName.trim().length
              ? row.displayName.trim()
              : normalizedValue
          const email =
            typeof row.primaryEmail === 'string' && row.primaryEmail.trim().length
              ? row.primaryEmail.trim()
              : null
          const domainRaw =
            companyRes.result.profile && typeof companyRes.result.profile.domain === 'string'
              ? companyRes.result.profile.domain.trim()
              : ''
          const subtitle = email ?? (domainRaw.length ? domainRaw : null)
          setEntityKind('company')
          setPreview({
            kind: 'company',
            title,
            subtitle,
            recordHref: `/backend/customers/companies-v2/${encodeURIComponent(normalizedValue)}`,
          })
          return
        }
        setEntityKind(null)
        setPendingPick(null)
        setPreview({
          kind: 'unknown',
          title: normalizedValue,
          subtitle: t(
            'resources.resources.form.fields.customer.previewUnknown',
            'This ID could not be resolved as a person or company.',
          ),
          recordHref: '#',
        })
      } finally {
        if (!cancelled) setKindResolving(false)
      }
    })().catch(() => {
      if (!cancelled) {
        setEntityKind(null)
        setPreview(null)
        setKindResolving(false)
        setPendingPick(null)
      }
    })
    return () => {
      cancelled = true
    }
  }, [normalizedValue, t])

  React.useEffect(() => {
    if (!pendingPick || !normalizedValue) return
    if (pendingPick.id !== normalizedValue) return
    if (entityKind === pendingPick.kind) {
      setPendingPick(null)
    }
  }, [entityKind, normalizedValue, pendingPick])

  const companyPickerValue =
    pendingPick?.kind === 'company'
      ? pendingPick.id
      : entityKind === 'company' && normalizedValue
        ? normalizedValue
        : undefined

  const personPickerValue =
    pendingPick?.kind === 'person'
      ? pendingPick.id
      : entityKind === 'person' && normalizedValue
        ? normalizedValue
        : undefined

  const hasCompanySelection =
    pendingPick?.kind === 'company' || Boolean(entityKind === 'company' && normalizedValue)
  const hasPersonSelection =
    pendingPick?.kind === 'person' || Boolean(entityKind === 'person' && normalizedValue)

  const basePickerDisabled = Boolean(disabled || (normalizedValue && kindResolving && !pendingPick))
  const companyPickerDisabled = basePickerDisabled || hasPersonSelection
  const personPickerDisabled = basePickerDisabled || hasCompanySelection

  const handleCompanyChange = React.useCallback(
    (next: string | undefined) => {
      const trimmed = typeof next === 'string' ? next.trim() : ''
      if (!trimmed.length) {
        setPendingPick(null)
        if (entityKind === 'company' || pendingPick?.kind === 'company') onChange(null)
        return
      }
      setPendingPick({ id: trimmed, kind: 'company' })
      onChange(trimmed)
    },
    [entityKind, onChange, pendingPick],
  )

  const handlePersonChange = React.useCallback(
    (next: string | undefined) => {
      const trimmed = typeof next === 'string' ? next.trim() : ''
      if (!trimmed.length) {
        setPendingPick(null)
        if (entityKind === 'person' || pendingPick?.kind === 'person') onChange(null)
        return
      }
      setPendingPick({ id: trimmed, kind: 'person' })
      onChange(trimmed)
    },
    [entityKind, onChange, pendingPick],
  )

  const companyHref =
    preview && preview.kind === 'company' && preview.recordHref !== '#'
      ? preview.recordHref
      : null
  const personHref =
    preview && preview.kind === 'person' && preview.recordHref !== '#'
      ? preview.recordHref
      : null
  const showCompanyOpen = Boolean(companyHref)
  const showPersonOpen = Boolean(personHref)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <div className="text-sm font-medium text-muted-foreground">
            {t('insurance_desk.policies.detail.customer.company', 'Company')}
          </div>
          <CustomerEntitySinglePicker
            kind="company"
            value={companyPickerValue}
            labels={companyLabels}
            disabled={companyPickerDisabled}
            onChange={handleCompanyChange}
          />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-muted-foreground">
            {t('insurance_desk.policies.detail.customer.person', 'Person')}
          </div>
          <CustomerEntitySinglePicker
            kind="person"
            value={personPickerValue}
            labels={personLabels}
            disabled={personPickerDisabled}
            restrictPersonToCompanyEntityId={null}
            onChange={handlePersonChange}
          />
        </div>
      </div>

      {normalizedValue ? (
        kindResolving ? (
          <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading…')}</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ResourceCustomerPreviewTile
                fieldLabel={t('insurance_desk.policies.detail.customer.company', 'Company')}
                recordHref={companyHref}
                showOpen={showCompanyOpen}
                t={t}
              >
                {preview?.kind === 'company' ? (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-foreground">{preview.title}</div>
                    {preview.subtitle ? (
                      <div className="text-xs text-muted-foreground">{preview.subtitle}</div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">—</p>
                )}
              </ResourceCustomerPreviewTile>
              <ResourceCustomerPreviewTile
                fieldLabel={t('insurance_desk.policies.detail.customer.person', 'Person')}
                recordHref={personHref}
                showOpen={showPersonOpen}
                t={t}
              >
                {preview?.kind === 'person' ? (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-foreground">{preview.title}</div>
                    {preview.subtitle ? (
                      <div className="text-xs text-muted-foreground">{preview.subtitle}</div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">—</p>
                )}
              </ResourceCustomerPreviewTile>
            </div>
            {preview?.kind === 'unknown' ? (
              <p className="text-xs text-muted-foreground">{preview.subtitle ?? preview.title}</p>
            ) : null}
          </div>
        )
      ) : null}
    </div>
  )
}
