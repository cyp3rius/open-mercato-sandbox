"use client"

import * as React from 'react'
import { z } from 'zod'
import { isValidNip, normalizeNipDigits } from '../lib/nip'
import { isValidPesel, normalizePeselDigits } from '../lib/pesel'
import { isValidRegon, normalizeRegonDigits } from '../lib/regon'
import Link from 'next/link'
import { Check, Pencil, Plus, Settings } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn as cnTw } from '@open-mercato/shared/lib/utils'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { Button } from '@open-mercato/ui/primitives/button'
import { IconButton } from '@open-mercato/ui/primitives/icon-button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@open-mercato/ui/primitives/dialog'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCall, apiCallOrThrow, readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { collectCustomFieldValues } from '@open-mercato/ui/backend/utils/customFieldValues'
import { PhoneNumberField } from '@open-mercato/ui/backend/inputs/PhoneNumberField'
import { isValidPhoneNumber } from '@open-mercato/shared/lib/phone'
import {
  CRUD_FORM_SELECT_CLASS,
  CRUD_FORM_TEXT_INPUT_CLASS,
  type CrudCustomFieldRenderProps,
  type CrudField,
  type CrudFormGroup,
  type CrudFormGroupComponentProps,
} from '@open-mercato/ui/backend/CrudForm'
import {
  DictionaryEntrySelect,
  type DictionarySelectLabels,
} from '@open-mercato/core/modules/dictionaries/components/DictionaryEntrySelect'
import { useQueryClient } from '@tanstack/react-query'
import { useEmailDuplicateCheck } from '../backend/hooks/useEmailDuplicateCheck'
import { lookupPhoneDuplicate } from '../utils/phoneDuplicates'
import { CustomerAddressTiles, type CustomerAddressInput, type CustomerAddressValue } from './AddressTiles'
import {
  ensureCustomerDictionary,
  invalidateCustomerDictionary,
} from './detail/hooks/useCustomerDictionary'
import type { CustomerDictionaryKind } from '../lib/dictionaries'
import { normalizeCustomFieldSubmitValue } from './detail/customFieldUtils'
import { CUSTOMER_PHONE_INVALID_MESSAGE_KEY } from '../data/validators'
import { createCompanyRegistrySyncBridgeField } from './companyRegistrySync'

export const metadata = {
  navHidden: true,
} as const

function cn(...values: Array<string | null | undefined | false>) {
  return values.filter(Boolean).join(' ')
}

function createCrmRecordTypeAndReferralField(t: Translator, variant: 'company' | 'person'): CrudField {
  const pf = variant === 'company' ? 'customers.companies.form' : 'customers.people.form'
  const hintKey =
    variant === 'company'
      ? 'customers.companies.form.referralCode.hint'
      : 'customers.people.form.referralCode.hint'
  return {
    id: 'crmRecordType',
    label: '',
    type: 'custom',
    layout: 'third',
    component: ({
      value,
      values,
      setValue,
      setFormValue,
      error,
      formErrors,
      autoFocus,
      disabled,
    }: CrudCustomFieldRenderProps) => {
      const crmRaw = typeof value === 'string' && value.length ? value : 'customer'
      const referral = typeof values?.referralCode === 'string' ? values.referralCode : ''
      const showReferral = crmRaw === 'partner' || crmRaw === 'referrer'
      React.useEffect(() => {
        if (!showReferral && referral.length > 0) {
          setFormValue?.('referralCode', '')
        }
      }, [showReferral, referral, setFormValue])
      const referralError = formErrors?.referralCode
      return (
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <label className="block text-sm font-medium" htmlFor={`crm-record-type-${variant}`}>
              {t(`${pf}.crmRecordType`, 'Record type')}
            </label>
            <select
              id={`crm-record-type-${variant}`}
              className={CRUD_FORM_SELECT_CLASS}
              value={crmRaw}
              onChange={(event) => setValue(event.target.value)}
              disabled={disabled}
              autoFocus={autoFocus}
              data-crud-focus-target=""
            >
              <option value="customer">{t(`${pf}.crmRecordType.customer`, 'Customer')}</option>
              <option value="partner">{t(`${pf}.crmRecordType.partner`, 'Partner')}</option>
              <option value="referrer">{t(`${pf}.crmRecordType.referrer`, 'Referrer')}</option>
            </select>
            {error ? <div className="text-xs text-red-600">{error}</div> : null}
          </div>
          {showReferral ? (
            <div className="min-w-0 flex-1 space-y-1">
              <label className="block text-sm font-medium" htmlFor={`referral-code-${variant}`}>
                {t(`${pf}.referralCode`, 'Referral code')}
              </label>
              <input
                id={`referral-code-${variant}`}
                className={CRUD_FORM_TEXT_INPUT_CLASS}
                value={referral}
                onChange={(event) => setFormValue?.('referralCode', event.target.value)}
                disabled={disabled}
                autoComplete="off"
                data-crud-focus-target=""
              />
              <p className="text-xs text-muted-foreground">
                {t(
                  hintKey,
                  'Unique code for partners/referrers: 3–64 alphanumeric characters when set.',
                )}
              </p>
              {referralError ? <div className="text-xs text-red-600">{referralError}</div> : null}
            </div>
          ) : null}
        </div>
      )
    },
  }
}

export type Translator = (
  key: string,
  fallback?: string,
  params?: Record<string, string | number>,
) => string

export type PersonFormValues = {
  displayName: string
  firstName: string
  lastName: string
  pesel?: string
  residenceStreet?: string
  residencePostalCode?: string
  residenceCity?: string
  residenceCountry?: string
  jobTitle?: string
  companyEntityId?: string | null
  primaryEmail?: string
  primaryPhone?: string
  status?: string
  lifecycleStage?: string
  source?: string
  crmRecordType?: string
  referralCode?: string
  description?: string
  addresses?: CustomerAddressValue[]
} & Record<string, unknown>

export type CompanyFormValues = {
  displayName: string
  primaryEmail?: string
  primaryPhone?: string
  status?: string
  lifecycleStage?: string
  source?: string
  crmRecordType?: string
  referralCode?: string
  legalName?: string
  brandName?: string
  domain?: string
  websiteUrl?: string
  industry?: string
  sizeBucket?: string
   annualRevenue?: string
  nip?: string
  regon?: string
  description?: string
  addresses?: CustomerAddressValue[]
} & Record<string, unknown>

type DictionarySelectFieldProps = {
  kind: CustomerDictionaryKind
  value?: string
  onChange: (value: string | undefined) => void
  labels: DictionarySelectLabels
  selectClassName?: string
}

const emailValidationSchema = z.string().email()
const EMAIL_CHECK_DEBOUNCE_MS = 350

const createSectionHeadingField = (id: string, title: string): CrudField => ({
  id,
  label: '',
  type: 'custom',
  layout: 'full',
  component: () => (
    <div className="mt-4 border-t border-border pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {title}
    </div>
  ),
})

export function DictionarySelectField({
  kind,
  value,
  onChange,
  labels,
  selectClassName,
}: DictionarySelectFieldProps) {
  const t = useT()
  const queryClient = useQueryClient()
  const scopeVersion = useOrganizationScopeVersion()
  const translate = React.useCallback(
    (key: string, fallback: string) => {
      const result = t(key)
      return result === key ? fallback : result
    },
    [t],
  )

  const appearanceLabels = React.useMemo(
    () => ({
      colorLabel: translate('customers.config.dictionaries.dialog.colorLabel', 'Color'),
      colorHelp: translate('customers.config.dictionaries.dialog.colorHelp', 'Pick a highlight color for this entry.'),
      colorClearLabel: translate('customers.config.dictionaries.dialog.colorClear', 'Remove color'),
      iconLabel: translate('customers.config.dictionaries.dialog.iconLabel', 'Icon or emoji'),
      iconPlaceholder: translate(
        'customers.config.dictionaries.dialog.iconPlaceholder',
        'Type an emoji or pick one of the suggestions.',
      ),
      iconPickerTriggerLabel: translate('customers.config.dictionaries.dialog.iconBrowse', 'Browse icons and emojis'),
      iconSearchPlaceholder: translate(
        'customers.config.dictionaries.dialog.iconSearchPlaceholder',
        'Search icons or emojis…',
      ),
      iconSearchEmptyLabel: translate(
        'customers.config.dictionaries.dialog.iconSearchEmpty',
        'No icons match your search.',
      ),
      iconSuggestionsLabel: translate('customers.config.dictionaries.dialog.iconSuggestions', 'Suggestions'),
      iconClearLabel: translate('customers.config.dictionaries.dialog.iconClear', 'Remove icon'),
      previewEmptyLabel: translate('customers.config.dictionaries.dialog.previewEmpty', 'No appearance selected'),
    }),
    [translate],
  )

  const fetchOptions = React.useCallback(async () => {
    const data = await ensureCustomerDictionary(queryClient, kind, scopeVersion)
    return data.entries.map((entry) => ({
      value: entry.value,
      label: entry.label,
      color: entry.color ?? null,
      icon: entry.icon ?? null,
    }))
  }, [kind, queryClient, scopeVersion])

  const createOption = React.useCallback(
    async (input: { value: string; label?: string; color?: string | null; icon?: string | null }) => {
      const call = await apiCall<Record<string, unknown>>(
        `/api/customers/dictionaries/${kind}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            value: input.value,
            label: input.label ?? input.value,
            color: input.color ?? undefined,
            icon: input.icon ?? undefined,
          }),
        },
      )
      const payload = call.result ?? {}
      if (!call.ok) {
        const message = typeof payload.error === 'string' ? payload.error : labels.errorSave
        throw new Error(message)
      }
      await invalidateCustomerDictionary(queryClient, kind)
      const valueCreated = typeof payload.value === 'string' ? payload.value : input.value
      const label =
        typeof payload.label === 'string' && payload.label.trim().length ? payload.label.trim() : valueCreated
      const color =
        typeof payload.color === 'string' && payload.color.trim().startsWith('#')
          ? payload.color.trim()
          : null
      const icon =
        typeof payload.icon === 'string' && payload.icon.trim().length ? payload.icon.trim() : null
      return { value: valueCreated, label, color, icon }
    },
    [kind, labels.errorSave, queryClient],
  )

  return (
    <DictionaryEntrySelect
      value={value}
      onChange={onChange}
      fetchOptions={fetchOptions}
      createOption={createOption}
      labels={labels}
      selectClassName={selectClassName}
      allowInlineCreate
      allowAppearance
      appearanceLabels={appearanceLabels}
      manageHref="/backend/config/customers"
      showLabelInput
    />
  )
}

const createPrimaryEmailField = (t: Translator): CrudField => ({
  id: 'primaryEmail',
  label: t('customers.people.form.primaryEmail'),
  type: 'custom',
  component: function PrimaryEmailField({ value, setValue, error, autoFocus, disabled, recordId }: CrudCustomFieldRenderProps) {
    const [inputValue, setInputValue] = React.useState(() => (typeof value === 'string' ? value : ''))
    const trimmedInput = inputValue.trim()
    const isValidEmail = React.useMemo(
      () => !!trimmedInput.length && emailValidationSchema.safeParse(trimmedInput).success,
      [trimmedInput]
    )
    const { duplicate, checking } = useEmailDuplicateCheck(inputValue, {
      recordId: typeof recordId === 'string' ? recordId : null,
      disabled: disabled || !!error || !isValidEmail,
      debounceMs: EMAIL_CHECK_DEBOUNCE_MS,
      matchMode: 'prefix',
    })

    React.useEffect(() => {
      setInputValue(typeof value === 'string' ? value : '')
    }, [value])

    return (
      <div className="space-y-2">
        <input
          type="email"
          className="w-full h-9 rounded border px-2 text-sm"
          value={inputValue}
          onChange={(event) => {
            const nextValue = event.target.value
            setInputValue(nextValue)
            setValue(nextValue)
          }}
          placeholder={t('customers.people.form.primaryEmailPlaceholder', 'name@example.com')}
          spellCheck={false}
          autoFocus={autoFocus}
          data-crud-focus-target=""
          disabled={disabled}
        />
        {!error && duplicate ? (
          <p className="text-xs text-amber-600">
            {t('customers.people.form.emailDuplicateNotice', undefined, { name: duplicate.displayName })}{' '}
            <Link className="font-medium text-primary underline underline-offset-2" href={`/backend/customers/people-v2/${duplicate.id}`}>
              {t('customers.people.form.emailDuplicateLink')}
            </Link>
          </p>
        ) : null}
        {!error && !duplicate && checking ? (
          <p className="text-xs text-muted-foreground">{t('customers.people.form.emailChecking')}</p>
        ) : null}
      </div>
    )
  },
})

type DictionaryFieldDefinition = {
  id: 'jobTitle' | 'status' | 'lifecycleStage' | 'source'
  kind: 'job-titles' | 'statuses' | 'lifecycle-stages' | 'sources'
  labelKey: string
  placeholderKey: string
  addLabelKey: string
  promptKey: string
  dialogTitleKey: string
  layout?: CrudField['layout']
}

const dictionaryFieldDefinitions: DictionaryFieldDefinition[] = [
  {
    id: 'jobTitle',
    kind: 'job-titles',
    labelKey: 'customers.people.form.jobTitle',
    placeholderKey: 'customers.people.form.jobTitle.placeholder',
    addLabelKey: 'customers.people.form.dictionary.addJobTitle',
    promptKey: 'customers.people.form.dictionary.promptJobTitle',
    dialogTitleKey: 'customers.people.form.dictionary.dialogTitleJobTitle',
    layout: 'half',
  },
  {
    id: 'status',
    kind: 'statuses',
    labelKey: 'customers.people.form.status',
    placeholderKey: 'customers.people.form.status.placeholder',
    addLabelKey: 'customers.people.form.dictionary.addStatus',
    promptKey: 'customers.people.form.dictionary.promptStatus',
    dialogTitleKey: 'customers.people.form.dictionary.dialogTitleStatus',
  },
  {
    id: 'lifecycleStage',
    kind: 'lifecycle-stages',
    labelKey: 'customers.people.form.lifecycleStage',
    placeholderKey: 'customers.people.form.lifecycleStage.placeholder',
    addLabelKey: 'customers.people.form.dictionary.addLifecycleStage',
    promptKey: 'customers.people.form.dictionary.promptLifecycleStage',
    dialogTitleKey: 'customers.people.form.dictionary.dialogTitleLifecycleStage',
  },
  {
    id: 'source',
    kind: 'sources',
    labelKey: 'customers.people.form.source',
    placeholderKey: 'customers.people.form.source.placeholder',
    addLabelKey: 'customers.people.form.dictionary.addSource',
    promptKey: 'customers.people.form.dictionary.promptSource',
    dialogTitleKey: 'customers.people.form.dictionary.dialogTitleSource',
  },
]

const buildDictionaryLabels = (t: Translator, definition: DictionaryFieldDefinition): DictionarySelectLabels => ({
  placeholder: t(definition.placeholderKey),
  addLabel: t(definition.addLabelKey),
  addPrompt: t(definition.promptKey),
  dialogTitle: t(definition.dialogTitleKey),
  valueLabel: t('customers.people.form.dictionary.valueLabel', 'Value'),
  valuePlaceholder: t('customers.people.form.dictionary.valuePlaceholder', 'Value'),
  labelLabel: t('customers.config.dictionaries.dialog.labelLabel', 'Label'),
  labelPlaceholder: t('customers.people.form.dictionary.labelPlaceholder', 'Display name shown in UI'),
  emptyError: t('customers.people.form.dictionary.errorRequired'),
  cancelLabel: t('customers.people.form.dictionary.cancel'),
  saveLabel: t('customers.people.form.dictionary.save'),
  successCreateLabel: undefined,
  errorLoad: t('customers.people.form.dictionary.errorLoad'),
  errorSave: t('customers.people.form.dictionary.error'),
  loadingLabel: t('customers.people.form.dictionary.loading'),
  manageTitle: t('customers.people.form.dictionary.manage'),
})

const companyDictionaryFieldDefinitions: DictionaryFieldDefinition[] = [
  {
    id: 'status',
    kind: 'statuses',
    labelKey: 'customers.companies.form.status',
    placeholderKey: 'customers.companies.form.status.placeholder',
    addLabelKey: 'customers.companies.form.dictionary.addStatus',
    promptKey: 'customers.companies.form.dictionary.promptStatus',
    dialogTitleKey: 'customers.companies.form.dictionary.dialogTitleStatus',
    layout: 'third',
  },
  {
    id: 'lifecycleStage',
    kind: 'lifecycle-stages',
    labelKey: 'customers.companies.form.lifecycleStage',
    placeholderKey: 'customers.companies.form.lifecycleStage.placeholder',
    addLabelKey: 'customers.companies.form.dictionary.addLifecycleStage',
    promptKey: 'customers.companies.form.dictionary.promptLifecycleStage',
    dialogTitleKey: 'customers.companies.form.dictionary.dialogTitleLifecycleStage',
    layout: 'third',
  },
  {
    id: 'source',
    kind: 'sources',
    labelKey: 'customers.companies.form.source',
    placeholderKey: 'customers.companies.form.source.placeholder',
    addLabelKey: 'customers.companies.form.dictionary.addSource',
    promptKey: 'customers.companies.form.dictionary.promptSource',
    dialogTitleKey: 'customers.companies.form.dictionary.dialogTitleSource',
    layout: 'third',
  },
]

const createPrimaryPhoneField = (t: Translator): CrudField => ({
  id: 'primaryPhone',
  label: t('customers.people.form.primaryPhone'),
  type: 'custom',
  component: function PrimaryPhoneField({ value, setValue, error, autoFocus, disabled, recordId }: CrudCustomFieldRenderProps) {
    const currentRecordId = React.useMemo(() => (typeof recordId === 'string' ? recordId : null), [recordId])

    const duplicateLookup = React.useCallback(
      async (digits: string) => {
        if (disabled || error) return null
        return lookupPhoneDuplicate(digits, { recordId: currentRecordId })
      },
      [currentRecordId, disabled, error]
    )

    return (
      <PhoneNumberField
        value={typeof value === 'string' ? value : null}
        onValueChange={(next) => setValue(typeof next === 'string' ? next : undefined)}
        externalError={error}
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={t('customers.people.form.primaryPhonePlaceholder', '+1 555 123 4567')}
        checkingLabel={t('customers.people.form.phoneChecking')}
        duplicateLabel={(match) => t('customers.people.form.phoneDuplicateNotice', undefined, { name: match.label })}
        duplicateLinkLabel={t('customers.people.form.phoneDuplicateLink')}
        invalidLabel={t('customers.people.form.primaryPhone.invalid', 'Enter a valid phone number with country code (e.g. +1 212 555 1234)')}
        minDigits={7}
        onDuplicateLookup={!disabled && !error ? duplicateLookup : undefined}
      />
    )
  },
})

const blankToUndefined = (value?: string | null): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

type CompanySelectLabels = {
  placeholder: string
  addLabel: string
  addPrompt?: string
  dialogTitle: string
  inputLabel: string
  inputPlaceholder: string
  emptyError: string
  cancelLabel: string
  saveLabel: string
  errorLoad: string
  errorSave: string
  loadingLabel: string
}

type CompanySelectFieldProps = {
  value?: string
  onChange: (value: string | undefined) => void
  labels: CompanySelectLabels
}

type CompanyOption = { value: string; label: string }

function normalizeCompanyOption(raw: unknown): CompanyOption | null {
  if (!raw || typeof raw !== 'object') return null
  const candidate = raw as Record<string, unknown>
  const id = typeof candidate.id === 'string' ? candidate.id : null
  if (!id) return null
  const displayName =
    typeof candidate.display_name === 'string' && candidate.display_name.trim().length
      ? candidate.display_name.trim()
      : typeof candidate.displayName === 'string' && candidate.displayName.trim().length
        ? candidate.displayName.trim()
        : null
  if (!displayName) return null
  return { value: id, label: displayName }
}

type CustomerEntityPickerOption = {
  id: string
  label: string
  subtitle?: string | null
}

function sanitizeCustomerEntityIds(ids: string[]): string[] {
  const set = new Set<string>()
  ids.forEach((candidate) => {
    const trimmed = typeof candidate === 'string' ? candidate.trim() : ''
    if (trimmed.length) set.add(trimmed)
  })
  return Array.from(set)
}

function extractCustomerPersonOption(record: Record<string, unknown>): CustomerEntityPickerOption | null {
  const id = typeof record.id === 'string' ? record.id : null
  if (!id) return null
  const displayName =
    typeof record.displayName === 'string' && record.displayName.trim().length
      ? record.displayName.trim()
      : typeof record.display_name === 'string' && record.display_name.trim().length
        ? (record.display_name as string).trim()
        : null
  const email =
    typeof record.primaryEmail === 'string' && record.primaryEmail.trim().length
      ? record.primaryEmail.trim()
      : typeof record.primary_email === 'string' && record.primary_email.trim().length
        ? (record.primary_email as string).trim()
        : null
  const label = displayName ?? email ?? id
  const subtitle = email && email !== label ? email : null
  return { id, label, subtitle }
}

function extractCustomerCompanyOption(record: Record<string, unknown>): CustomerEntityPickerOption | null {
  const id = typeof record.id === 'string' ? record.id : null
  if (!id) return null
  const displayName =
    typeof record.displayName === 'string' && record.displayName.trim().length
      ? record.displayName.trim()
      : typeof record.display_name === 'string' && record.display_name.trim().length
        ? (record.display_name as string).trim()
        : null
  const domain =
    typeof record.domain === 'string' && record.domain.trim().length
      ? record.domain.trim()
      : typeof record.websiteUrl === 'string' && record.websiteUrl.trim().length
        ? record.websiteUrl.trim()
        : typeof record.website_url === 'string' && record.website_url.trim().length
          ? (record.website_url as string).trim()
          : null
  const label = displayName ?? domain ?? id
  const subtitle = domain && domain !== label ? domain : null
  return { id, label, subtitle }
}

async function searchCustomerPeopleApi(query: string): Promise<CustomerEntityPickerOption[]> {
  const params = new URLSearchParams({
    pageSize: '20',
    sortField: 'name',
    sortDir: 'asc',
  })
  if (query.trim().length) params.set('search', query.trim())
  const call = await apiCall<Record<string, unknown>>(`/api/customers/people?${params.toString()}`)
  if (!call.ok) {
    throw new Error(typeof call.result?.error === 'string' ? String(call.result?.error) : 'Failed to search people')
  }
  const payload = call.result ?? {}
  const items = Array.isArray(payload.items) ? payload.items : []
  return items
    .map((item: unknown) =>
      item && typeof item === 'object' ? extractCustomerPersonOption(item as Record<string, unknown>) : null,
    )
    .filter((entry: CustomerEntityPickerOption | null): entry is CustomerEntityPickerOption => entry !== null)
}

async function fetchCustomerPeopleByIdsApi(ids: string[]): Promise<CustomerEntityPickerOption[]> {
  const unique = sanitizeCustomerEntityIds(ids)
  if (!unique.length) return []
  const results = await Promise.all(
    unique.map(async (id) => {
      try {
        const call = await apiCall<Record<string, unknown>>(
          `/api/customers/people?id=${encodeURIComponent(id)}&pageSize=1`,
        )
        if (!call.ok) throw new Error()
        const payload = call.result ?? {}
        const items = Array.isArray(payload.items) ? payload.items : []
        const option = items
          .map((item: unknown) =>
            item && typeof item === 'object' ? extractCustomerPersonOption(item as Record<string, unknown>) : null,
          )
          .find((candidate: CustomerEntityPickerOption | null): candidate is CustomerEntityPickerOption => candidate !== null)
        return option ?? { id, label: id }
      } catch {
        return { id, label: id }
      }
    }),
  )
  return results
}

async function searchCustomerCompaniesApi(query: string): Promise<CustomerEntityPickerOption[]> {
  const params = new URLSearchParams({
    pageSize: '20',
    sortField: 'name',
    sortDir: 'asc',
  })
  if (query.trim().length) params.set('search', query.trim())
  const call = await apiCall<Record<string, unknown>>(`/api/customers/companies?${params.toString()}`)
  if (!call.ok) {
    throw new Error(
      typeof call.result?.error === 'string' ? String(call.result?.error) : 'Failed to search companies',
    )
  }
  const payload = call.result ?? {}
  const items = Array.isArray(payload.items) ? payload.items : []
  return items
    .map((item: unknown) =>
      item && typeof item === 'object' ? extractCustomerCompanyOption(item as Record<string, unknown>) : null,
    )
    .filter((entry: CustomerEntityPickerOption | null): entry is CustomerEntityPickerOption => entry !== null)
}

async function fetchCustomerCompaniesByIdsApi(ids: string[]): Promise<CustomerEntityPickerOption[]> {
  const unique = sanitizeCustomerEntityIds(ids)
  if (!unique.length) return []
  const results = await Promise.all(
    unique.map(async (id) => {
      try {
        const call = await apiCall<Record<string, unknown>>(
          `/api/customers/companies?id=${encodeURIComponent(id)}&pageSize=1`,
        )
        if (!call.ok) throw new Error()
        const payload = call.result ?? {}
        const items = Array.isArray(payload.items) ? payload.items : []
        const option = items
          .map((item: unknown) =>
            item && typeof item === 'object' ? extractCustomerCompanyOption(item as Record<string, unknown>) : null,
          )
          .find((candidate: CustomerEntityPickerOption | null): candidate is CustomerEntityPickerOption => candidate !== null)
        return option ?? { id, label: id }
      } catch {
        return { id, label: id }
      }
    }),
  )
  return results
}

export type CustomerEntitySinglePickerLabels = {
  searchPlaceholder: string
  loadingLabel: string
  noResultsLabel: string
  errorLabel: string
  addLabel: string
  companyDialogTitle: string
  companyDialogDescription?: string
  companyNameLabel: string
  companyNamePlaceholder: string
  personDialogTitle: string
  personDialogDescription?: string
  personFirstNameLabel: string
  personLastNameLabel: string
  cancelLabel: string
  saveLabel: string
  emptyError: string
  errorSave: string
  removeSelectionAria: string
}

type CustomerEntitySinglePickerProps = {
  kind: 'person' | 'company'
  value?: string | null
  onChange: (next: string | undefined) => void
  labels: CustomerEntitySinglePickerLabels
  disabled?: boolean
}

/**
 * Searchable single-select for a CRM person or company (same search/list API as deal associations),
 * with a quick-add (+) dialog matching company/person create shortcuts on customer forms.
 */
export function CustomerEntitySinglePicker({
  kind,
  value,
  onChange,
  labels,
  disabled = false,
}: CustomerEntitySinglePickerProps) {
  const scopeVersion = useOrganizationScopeVersion()
  const normalized = typeof value === 'string' && value.trim().length ? value.trim() : undefined
  const [input, setInput] = React.useState('')
  const [suggestions, setSuggestions] = React.useState<CustomerEntityPickerOption[]>([])
  const [cache, setCache] = React.useState<Map<string, CustomerEntityPickerOption>>(() => new Map())
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [newCompanyName, setNewCompanyName] = React.useState('')
  const [newPersonFirst, setNewPersonFirst] = React.useState('')
  const [newPersonLast, setNewPersonLast] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  const search = React.useMemo(
    () => (kind === 'person' ? searchCustomerPeopleApi : searchCustomerCompaniesApi),
    [kind],
  )
  const fetchByIds = React.useMemo(
    () => (kind === 'person' ? fetchCustomerPeopleByIdsApi : fetchCustomerCompaniesByIdsApi),
    [kind],
  )

  React.useEffect(() => {
    setCache(new Map())
    setSuggestions([])
    setInput('')
    setError(null)
  }, [scopeVersion])

  React.useEffect(() => {
    if (!normalized) return
    let cancelled = false
    ;(async () => {
      try {
        const entries = await fetchByIds([normalized])
        if (cancelled) return
        setCache((prev) => {
          const next = new Map(prev)
          entries.forEach((entry) => {
            if (entry?.id) next.set(entry.id, entry)
          })
          return next
        })
      } catch {
        if (!cancelled) setError(labels.errorLabel)
      }
    })().catch(() => {})
       return () => {
      cancelled = true
    }
  }, [fetchByIds, labels.errorLabel, normalized, scopeVersion])

  React.useEffect(() => {
    if (disabled) {
      setLoading(false)
      return
    }
    let cancelled = false
    const handler = window.setTimeout(async () => {
      setLoading(true)
      try {
        const results = await search(input.trim())
        if (cancelled) return
        setSuggestions(results)
        setCache((prev) => {
          const next = new Map(prev)
          results.forEach((entry) => {
            if (entry?.id) next.set(entry.id, entry)
          })
          return next
        })
        setError(null)
      } catch {
        if (!cancelled) {
          setError(labels.errorLabel)
          setSuggestions([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 200)
    return () => {
      cancelled = true
      window.clearTimeout(handler)
    }
  }, [disabled, input, labels.errorLabel, scopeVersion, search])

  const selected = normalized ? (cache.get(normalized) ?? { id: normalized, label: normalized }) : null

  const filteredSuggestions = React.useMemo(
    () => suggestions.filter((option) => option.id !== normalized),
    [normalized, suggestions],
  )

  const pickOption = React.useCallback(
    (option: CustomerEntityPickerOption) => {
      if (!option?.id) return
      onChange(option.id)
      setCache((prev) => {
        const next = new Map(prev)
        next.set(option.id, option)
        return next
      })
      setInput('')
      setSuggestions([])
    },
    [onChange],
  )

  const clearSelection = React.useCallback(() => {
    onChange(undefined)
    setInput('')
    setSuggestions([])
  }, [onChange])

  const handleDialogChange = React.useCallback((open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      setNewCompanyName('')
      setNewPersonFirst('')
      setNewPersonLast('')
      setFormError(null)
      setSaving(false)
    }
  }, [])

  const handleQuickCreate = React.useCallback(async () => {
    if (saving) return
    if (kind === 'company') {
      const trimmed = newCompanyName.trim()
      if (!trimmed) {
        setFormError(labels.emptyError)
        return
      }
      setSaving(true)
      try {
        const call = await apiCallOrThrow<{ id?: string; entityId?: string }>(
          '/api/customers/companies',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ displayName: trimmed }),
          },
          { errorMessage: labels.errorSave },
        )
        const payload = call.result ?? {}
        const createdId =
          typeof payload?.id === 'string'
            ? payload.id
            : typeof payload?.entityId === 'string'
              ? payload.entityId
              : null
        if (createdId) {
          const label = trimmed
          pickOption({ id: createdId, label })
        }
        setDialogOpen(false)
        setNewCompanyName('')
        setFormError(null)
      } catch (err) {
        const message = err instanceof Error ? err.message : labels.errorSave
        flash(message, 'error')
      } finally {
        setSaving(false)
      }
      return
    }

    const fn = newPersonFirst.trim()
    const ln = newPersonLast.trim()
    if (!fn.length || !ln.length) {
      setFormError(labels.emptyError)
      return
    }
    const displayName = `${fn} ${ln}`.trim()
    setSaving(true)
    try {
      const call = await apiCallOrThrow<{ id?: string; entityId?: string }>(
        '/api/customers/people',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            firstName: fn,
            lastName: ln,
            displayName,
          }),
        },
        { errorMessage: labels.errorSave },
      )
      const payload = call.result ?? {}
      const createdId =
        typeof payload?.id === 'string'
          ? payload.id
          : typeof payload?.entityId === 'string'
            ? payload.entityId
            : null
      if (createdId) {
        pickOption({ id: createdId, label: displayName })
      }
      setDialogOpen(false)
      setNewPersonFirst('')
      setNewPersonLast('')
      setFormError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : labels.errorSave
      flash(message, 'error')
    } finally {
      setSaving(false)
    }
  }, [
    kind,
    labels.emptyError,
    labels.errorSave,
    newCompanyName,
    newPersonFirst,
    newPersonLast,
    pickOption,
    saving,
  ])

  const busy = disabled || saving

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2 rounded border px-2 py-1">
            {selected ? (
              <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs">
                {selected.label}
                <IconButton
                  variant="ghost"
                  size="xs"
                  className="opacity-60 hover:opacity-100"
                  onClick={() => clearSelection()}
                  aria-label={labels.removeSelectionAria}
                  disabled={busy}
                >
                  ×
                </IconButton>
              </span>
            ) : null}
            <input
              type="text"
              className="min-w-[140px] flex-1 border-0 bg-transparent py-1 text-sm outline-none"
              value={input}
              placeholder={labels.searchPlaceholder}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  const nextOption = filteredSuggestions[0]
                  if (nextOption) pickOption(nextOption)
                }
              }}
              disabled={busy}
            />
          </div>
          {loading ? <div className="text-xs text-muted-foreground">{labels.loadingLabel}</div> : null}
          {!loading && filteredSuggestions.length ? (
            <div className="flex flex-wrap gap-2">
              {filteredSuggestions.slice(0, 10).map((option) => (
                <Button
                  key={option.id}
                  variant="outline"
                  size="sm"
                  className="h-auto px-2 py-1 text-xs font-normal"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pickOption(option)}
                  disabled={busy}
                >
                  <span className="flex flex-col items-start">
                    <span>{option.label}</span>
                    {option.subtitle ? (
                      <span className="text-[10px] text-muted-foreground">{option.subtitle}</span>
                    ) : null}
                  </span>
                </Button>
              ))}
            </div>
          ) : null}
          {!loading && !filteredSuggestions.length && input.trim().length ? (
            <div className="text-xs text-muted-foreground">{labels.noResultsLabel}</div>
          ) : null}
          {error ? <div className="text-xs text-red-600">{error}</div> : null}
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              disabled={busy}
              aria-label={labels.addLabel}
              title={labels.addLabel}
            >
              <Plus className="h-4 w-4" aria-hidden />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{kind === 'company' ? labels.companyDialogTitle : labels.personDialogTitle}</DialogTitle>
              {kind === 'company' && labels.companyDialogDescription ? (
                <DialogDescription>{labels.companyDialogDescription}</DialogDescription>
              ) : null}
              {kind === 'person' && labels.personDialogDescription ? (
                <DialogDescription>{labels.personDialogDescription}</DialogDescription>
              ) : null}
            </DialogHeader>
            <div className="space-y-4">
              {kind === 'company' ? (
                <div className="space-y-1">
                  <label className="text-sm font-medium">{labels.companyNameLabel}</label>
                  <input
                    className={CRUD_FORM_TEXT_INPUT_CLASS}
                    placeholder={labels.companyNamePlaceholder}
                    value={newCompanyName}
                    onChange={(event) => {
                      setNewCompanyName(event.target.value)
                      if (formError) setFormError(null)
                    }}
                    disabled={saving}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        handleQuickCreate().catch(() => {})
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">{labels.personFirstNameLabel}</label>
                    <input
                      className={CRUD_FORM_TEXT_INPUT_CLASS}
                      value={newPersonFirst}
                      onChange={(event) => {
                        setNewPersonFirst(event.target.value)
                        if (formError) setFormError(null)
                      }}
                      disabled={saving}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">{labels.personLastNameLabel}</label>
                    <input
                      className={CRUD_FORM_TEXT_INPUT_CLASS}
                      value={newPersonLast}
                      onChange={(event) => {
                        setNewPersonLast(event.target.value)
                        if (formError) setFormError(null)
                      }}
                      disabled={saving}
                    />
                  </div>
                </div>
              )}
              {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                  {labels.cancelLabel}
                </Button>
                <Button type="button" onClick={() => handleQuickCreate().catch(() => {})} disabled={saving}>
                  {saving ? `${labels.saveLabel}…` : labels.saveLabel}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export function CompanySelectField({ value, onChange, labels }: CompanySelectFieldProps) {
  const [options, setOptions] = React.useState<CompanyOption[]>([])
  const [loading, setLoading] = React.useState(true)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [newCompany, setNewCompany] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  const loadOptions = React.useCallback(async () => {
    setLoading(true)
    try {
      const payload = await readApiResultOrThrow<{ items?: unknown[] }>(
        '/api/customers/companies?pageSize=100&sortField=name&sortDir=asc',
        undefined,
        { errorMessage: labels.errorLoad },
      )
      const items = Array.isArray(payload?.items) ? payload.items : []
      const normalized = items
        .map((item: unknown) => normalizeCompanyOption(item))
        .filter((item: CompanyOption | null): item is CompanyOption => item !== null)
        .sort((a: CompanyOption, b: CompanyOption) =>
          a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
        )
      setOptions(normalized)
    } catch (err) {
      const message = err instanceof Error ? err.message : labels.errorLoad
      flash(message, 'error')
      setOptions([])
    } finally {
      setLoading(false)
    }
  }, [labels.errorLoad])

  React.useEffect(() => {
    loadOptions().catch(() => {})
  }, [loadOptions])

  const handleDialogChange = React.useCallback((open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      setNewCompany('')
      setFormError(null)
      setSaving(false)
    }
  }, [])

  const handleDialogSubmit = React.useCallback(async () => {
    if (saving) return
    const trimmed = newCompany.trim()
    if (!trimmed) {
      setFormError(labels.emptyError)
      return
    }
    setSaving(true)
    try {
      const call = await apiCallOrThrow<{ id?: string; entityId?: string }>(
        '/api/customers/companies',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ displayName: trimmed }),
        },
        { errorMessage: labels.errorSave },
      )
      const payload = call.result ?? {}
      const createdId =
        typeof payload?.id === 'string'
          ? payload.id
          : typeof payload?.entityId === 'string'
            ? payload.entityId
            : null
      await loadOptions()
      if (createdId) {
        onChange(createdId)
      }
      setDialogOpen(false)
      setNewCompany('')
      setFormError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : labels.errorSave
      flash(message, 'error')
    } finally {
      setSaving(false)
    }
  }, [labels.emptyError, labels.errorSave, loadOptions, newCompany, onChange, saving])

  const handleInputKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        handleDialogSubmit().catch(() => {})
      }
    },
    [handleDialogSubmit]
  )

  const disabled = loading || saving

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <select
          className="w-full h-9 rounded border px-2 text-sm"
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value ? event.target.value : undefined)}
          disabled={loading}
        >
          <option value="">{labels.placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={disabled}
              aria-label={labels.addLabel}
              title={labels.addLabel}
            >
              <Plus className="h-4 w-4" aria-hidden />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{labels.dialogTitle}</DialogTitle>
              {labels.addPrompt ? <DialogDescription>{labels.addPrompt}</DialogDescription> : null}
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">{labels.inputLabel}</label>
                <input
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder={labels.inputPlaceholder}
                  value={newCompany}
                  onChange={(event) => {
                    setNewCompany(event.target.value)
                    if (formError) setFormError(null)
                  }}
                  onKeyDown={handleInputKeyDown}
                  autoFocus
                  disabled={saving}
                />
              </div>
              {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                  {labels.cancelLabel}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    handleDialogSubmit().catch(() => {})
                  }}
                  disabled={saving || !newCompany.trim()}
                >
                  {saving ? `${labels.saveLabel}…` : labels.saveLabel}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? <div className="text-xs text-muted-foreground">{labels.loadingLabel}</div> : null}
    </div>
  )
}

export const createPersonFormSchema = () =>
  z
    .object({
      displayName: z.string().trim().min(1),
      firstName: z.string().trim().min(1),
      lastName: z.string().trim().min(1),
      jobTitle: z
        .string()
        .trim()
        .optional()
        .or(z.literal(''))
        .transform((val) => (val === '' ? undefined : val))
        .optional(),
      primaryEmail: z
        .string()
        .trim()
        .email()
        .optional()
        .or(z.literal(''))
        .transform((val) => (val === '' ? undefined : val)),
      primaryPhone: z
        .string()
        .trim()
        .max(50)
        .refine((value) => isValidPhoneNumber(value), { message: CUSTOMER_PHONE_INVALID_MESSAGE_KEY })
        .optional()
        .or(z.literal(''))
        .transform((val) => (val === '' ? undefined : val))
        .optional(),
      status: z
        .string()
        .trim()
        .optional()
        .or(z.literal(''))
        .transform((val) => (val === '' ? undefined : val))
        .optional(),
      lifecycleStage: z
        .string()
        .trim()
        .optional()
        .or(z.literal(''))
        .transform((val) => (val === '' ? undefined : val))
        .optional(),
      source: z
        .string()
        .trim()
        .optional()
        .or(z.literal(''))
        .transform((val) => (val === '' ? undefined : val))
        .optional(),
      description: z
        .string()
        .trim()
        .optional()
        .or(z.literal(''))
        .transform((val) => (val === '' ? undefined : val))
        .optional(),
      companyEntityId: z
        .string()
        .trim()
        .uuid()
        .optional()
        .or(z.literal(''))
        .transform((val) => (val === '' ? undefined : val))
        .optional(),
      crmRecordType: z.enum(['customer', 'partner', 'referrer']).optional(),
      referralCode: z
        .string()
        .trim()
        .optional()
        .or(z.literal(''))
        .transform((val) => (val === '' ? undefined : val))
        .optional(),
      pesel: z
        .string()
        .optional()
        .or(z.literal(''))
        .transform((val) => (val === '' ? undefined : val)),
      residenceStreet: z
        .string()
        .trim()
        .optional()
        .or(z.literal(''))
        .transform((val) => (val === '' ? undefined : val)),
      residencePostalCode: z
        .string()
        .trim()
        .optional()
        .or(z.literal(''))
        .transform((val) => (val === '' ? undefined : val)),
      residenceCity: z
        .string()
        .trim()
        .optional()
        .or(z.literal(''))
        .transform((val) => (val === '' ? undefined : val)),
      residenceCountry: z
        .string()
        .trim()
        .optional()
        .or(z.literal(''))
        .transform((val) => (val === '' ? undefined : val.toUpperCase())),
    })
    .passthrough()
    .superRefine((data, ctx) => {
      const raw = data.pesel
      if (raw === undefined || raw === '') return
      const digits = normalizePeselDigits(String(raw))
      if (!digits || digits.length !== 11 || !isValidPesel(digits)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['pesel'],
          message: 'Invalid PESEL',
        })
      }
    })
    .superRefine((data, ctx) => {
      const c = data.residenceCountry
      if (c === undefined || c === '') return
      if (!/^[A-Z]{2}$/.test(String(c))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['residenceCountry'],
          message: 'Use2-letter country code',
        })
      }
    })

export const createDisplayNameSection = (t: Translator) =>
  function DisplayNameSection({ values, setValue, errors }: CrudFormGroupComponentProps) {
    const [editing, setEditing] = React.useState(false)
    const [manualOverride, setManualOverride] = React.useState(() => {
      const current = typeof values.displayName === 'string' ? values.displayName.trim() : ''
      return current.length > 0
    })

    const first = typeof values.firstName === 'string' ? values.firstName.trim() : ''
    const last = typeof values.lastName === 'string' ? values.lastName.trim() : ''
    const derived = React.useMemo(() => {
      const parts = [first, last].filter((part) => !!part)
      return parts.join(' ').trim()
    }, [first, last])

    React.useEffect(() => {
      if (!manualOverride) {
        const target = derived || ''
        const current = typeof values.displayName === 'string' ? values.displayName : ''
        if (current !== target) {
          setValue('displayName', target)
        }
      }
    }, [manualOverride, derived, setValue, values.displayName])

    const currentValue = typeof values.displayName === 'string' ? values.displayName : ''
    const previewValue = currentValue || derived
    const placeholder = t('customers.people.form.displayNamePreview.empty')
    const error = errors.displayName

    const toggleEditing = () => {
      if (!editing && !manualOverride) {
        const target = derived || previewValue || ''
        setValue('displayName', target)
        setManualOverride(true)
      }
      setEditing((state) => !state)
    }

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!manualOverride) setManualOverride(true)
      setValue('displayName', event.target.value)
    }

    const handleReset = () => {
      setManualOverride(false)
      setEditing(false)
    }

    return (
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('customers.people.form.displayNamePreview')}
            </div>
            {editing ? (
              <div className="mt-2 space-y-2">
                <input
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={currentValue}
                  onChange={handleChange}
                  placeholder={t('customers.people.form.displayName.placeholder')}
                />
                {error ? <p className="text-xs text-red-600">{error}</p> : null}
              </div>
            ) : (
              <div className="mt-1 text-base font-medium">{previewValue || placeholder}</div>
            )}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={toggleEditing}>
            {editing ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                {t('customers.people.form.displayName.done')}
              </>
            ) : (
              <>
                <Pencil className="mr-2 h-4 w-4" />
                {t('customers.people.form.displayName.edit')}
              </>
            )}
          </Button>
        </div>
        {manualOverride ? (
          <div className="mt-3">
            <Button type="button" variant="ghost" size="sm" onClick={handleReset} disabled={!derived}>
              {t('customers.people.form.displayName.reset')}
            </Button>
          </div>
        ) : null}
      </div>
    )
  }

export const createPersonFormFields = (t: Translator): CrudField[] => {
  const contactSection = createSectionHeadingField('__contactInformationSection', t('customers.people.form.sections.contactInformation'))
  const registeredAddressSection = createSectionHeadingField(
    '__registeredAddressSection',
    t('customers.people.form.sections.registeredAddress'),
  )
  const companySection = createSectionHeadingField('__companyInformationSection', t('customers.people.form.sections.companyInformation'))
const dictionaryFields: CrudField[] = dictionaryFieldDefinitions.map((definition) => ({
  id: definition.id,
  label: t(definition.labelKey),
  type: 'custom',
  layout: definition.layout ?? 'third',
  component: ({ value, setValue }: CrudCustomFieldRenderProps) => (
    <DictionarySelectField
      kind={definition.kind}
      value={typeof value === 'string' ? value : undefined}
      onChange={(next) => setValue(next)}
        labels={buildDictionaryLabels(t, definition)}
      />
    ),
  }))

  return [
    { id: 'displayName', label: t('customers.people.form.displayName.label'), type: 'text', required: true },
    { id: 'firstName', label: t('customers.people.form.firstName'), type: 'text', required: true, layout: 'half' },
    { id: 'lastName', label: t('customers.people.form.lastName'), type: 'text', required: true, layout: 'half' },
    contactSection,
    createPrimaryEmailField(t),
    createPrimaryPhoneField(t),
    registeredAddressSection,
    {
      id: 'pesel',
      label: t('customers.people.form.pesel'),
      type: 'custom',
      layout: 'half',
      component: ({ value, setValue, disabled, error }) => {
        const raw = typeof value === 'string' ? value : ''
        const digits = raw.trim().length ? normalizePeselDigits(raw) : null
        const liveInvalid =
          raw.trim().length > 0 && (!digits || digits.length !== 11 || !isValidPesel(digits))
        const liveMessage = liveInvalid ? t('customers.people.form.peselInvalid') : null
        return (
          <div className="space-y-1">
            <input
              className={cnTw(CRUD_FORM_TEXT_INPUT_CLASS, (liveMessage || error) && 'border-destructive')}
              value={raw}
              onChange={(e) => setValue(e.target.value)}
              disabled={disabled}
              placeholder={t('customers.people.form.peselPlaceholder')}
              data-crud-focus-target=""
            />
            {liveMessage ? <p className="text-sm text-destructive">{liveMessage}</p> : null}
          </div>
        )
      },
    },
    {
      id: 'residenceStreet',
      label: t('customers.people.form.residenceStreet'),
      type: 'text',
      layout: 'full',
      placeholder: t('customers.people.form.residenceStreetPlaceholder'),
    },
    {
      id: 'residencePostalCode',
      label: t('customers.people.form.residencePostalCode'),
      type: 'text',
      layout: 'half',
      placeholder: t('customers.people.form.residencePostalCodePlaceholder'),
    },
    {
      id: 'residenceCity',
      label: t('customers.people.form.residenceCity'),
      type: 'text',
      layout: 'half',
      placeholder: t('customers.people.form.residenceCityPlaceholder'),
    },
    {
      id: 'residenceCountry',
      label: t('customers.people.form.residenceCountry'),
      type: 'text',
      layout: 'half',
      placeholder: t('customers.people.form.residenceCountryPlaceholder'),
    },
    companySection,
    {
      id: 'companyEntityId',
      label: t('customers.people.form.company'),
      type: 'custom',
      layout: 'half',
      component: ({ value, setValue }) => (
        <CompanySelectField
          value={typeof value === 'string' ? value : undefined}
          onChange={(next) => setValue(next)}
          labels={{
            placeholder: t('customers.people.form.company.placeholder'),
            addLabel: t('customers.people.form.company.add'),
            addPrompt: t('customers.people.form.company.prompt'),
            dialogTitle: t('customers.people.form.company.dialogTitle'),
            inputLabel: t('customers.people.form.company.inputLabel'),
            inputPlaceholder: t('customers.people.form.company.inputPlaceholder'),
            emptyError: t('customers.people.form.dictionary.errorRequired'),
            cancelLabel: t('customers.people.form.dictionary.cancel'),
            saveLabel: t('customers.people.form.dictionary.save'),
            errorLoad: t('customers.people.form.dictionary.errorLoad'),
            errorSave: t('customers.people.form.dictionary.error'),
            loadingLabel: t('customers.people.form.company.loading'),
          }}
        />
      ),
    },
    ...dictionaryFields,
    createCrmRecordTypeAndReferralField(t, 'person'),
    { id: 'description', label: t('customers.people.form.description'), type: 'textarea' },
    {
      id: 'addresses',
      label: '',
      type: 'custom',
      layout: 'full',
      component: ({ value, setValue }: CrudCustomFieldRenderProps) => {
        const addresses = Array.isArray(value) ? (value as CustomerAddressValue[]) : []
        return (
          <CustomerAddressTiles
            addresses={addresses}
            t={t}
            emptyLabel={t('customers.people.detail.empty.addresses')}
            gridClassName="grid gap-4 min-[480px]:grid-cols-1 xl:grid-cols-2"
            onCreate={async (payload: CustomerAddressInput) => {
              const nextId =
                typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                  ? crypto.randomUUID()
                  : `tmp-${Math.random().toString(36).slice(2)}`
              const next: CustomerAddressValue = {
                id: nextId,
                name: payload.name ?? undefined,
                purpose: payload.purpose ?? undefined,
                companyName: payload.companyName ?? undefined,
                addressLine1: payload.addressLine1,
                addressLine2: payload.addressLine2 ?? undefined,
                buildingNumber: payload.buildingNumber ?? undefined,
                flatNumber: payload.flatNumber ?? undefined,
                city: payload.city ?? undefined,
                region: payload.region ?? undefined,
                postalCode: payload.postalCode ?? undefined,
                country: payload.country ?? undefined,
                isPrimary: payload.isPrimary ?? false,
              }
              const current = Array.isArray(addresses) ? addresses : []
              const nextAddresses =
                next.isPrimary === true
                  ? [next, ...current.map((item) => ({ ...item, isPrimary: false }))]
                  : [next, ...current]
              setValue(nextAddresses)
            }}
            onUpdate={async (id, payload) => {
              const current = Array.isArray(addresses) ? addresses : []
              const updated = current.map((item) => {
                if (item.id !== id) {
                  return payload.isPrimary ? { ...item, isPrimary: false } : item
                }
                return {
                  ...item,
                  name: payload.name ?? null,
                  purpose: payload.purpose ?? null,
                  companyName: payload.companyName ?? null,
                  addressLine1: payload.addressLine1,
                  addressLine2: payload.addressLine2 ?? null,
                  buildingNumber: payload.buildingNumber ?? null,
                  flatNumber: payload.flatNumber ?? null,
                  city: payload.city ?? null,
                  region: payload.region ?? null,
                  postalCode: payload.postalCode ?? null,
                  country: payload.country ?? null,
                  isPrimary: payload.isPrimary ?? false,
                }
              })
              setValue(updated)
            }}
            onDelete={async (id) => {
              const current = Array.isArray(addresses) ? addresses : []
              setValue(current.filter((item) => item.id !== id))
            }}
          />
        )
      },
    },
  ]
}

export const createPersonFormGroups = (t: Translator): CrudFormGroup[] => [
  {
    id: 'details',
    title: t('customers.people.form.groups.details'),
    column: 1,
    fields: [
      'firstName',
      'lastName',
      '__contactInformationSection',
      'primaryEmail',
      'primaryPhone',
      '__registeredAddressSection',
      'pesel',
      'residenceStreet',
      'residencePostalCode',
      'residenceCity',
      'residenceCountry',
      '__companyInformationSection',
      'jobTitle',
      'companyEntityId',
      'status',
      'lifecycleStage',
      'source',
      'crmRecordType',
    ],
    component: createDisplayNameSection(t),
  },
  {
    id: 'addresses',
    title: t('customers.people.form.groups.addresses'),
    column: 1,
    fields: ['addresses'],
  },
  {
    id: 'notes',
    title: t('customers.people.form.groups.notes'),
    column: 2,
    fields: ['description'],
  },
  {
    id: 'customFields',
    title: t('customers.people.form.groups.custom'),
    column: 2,
    kind: 'customFields',
  },
]

export function buildPersonPayload(
  values: PersonFormValues | PersonEditFormValues,
  organizationId?: string | null,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  const displayNameValue = typeof values.displayName === 'string' ? values.displayName.trim() : ''
  if (!displayNameValue) {
    throw new Error('DISPLAY_NAME_REQUIRED')
  }
  payload.displayName = displayNameValue
  payload.firstName = typeof values.firstName === 'string' ? values.firstName.trim() : ''
  payload.lastName = typeof values.lastName === 'string' ? values.lastName.trim() : ''

  const assign = (key: string, val?: string | null) => {
    if (val === null) {
      payload[key] = null
      return
    }
    const normalized = blankToUndefined(val)
    if (normalized !== undefined) payload[key] = normalized
  }

  assign('jobTitle', typeof values.jobTitle === 'string' ? values.jobTitle : undefined)
  assign('primaryEmail', typeof values.primaryEmail === 'string' ? values.primaryEmail : undefined)
  assign('primaryPhone', typeof values.primaryPhone === 'string' ? values.primaryPhone : undefined)
  assign('status', typeof values.status === 'string' ? values.status : undefined)
  assign('lifecycleStage', typeof values.lifecycleStage === 'string' ? values.lifecycleStage : undefined)
  assign('source', typeof values.source === 'string' ? values.source : undefined)
  assign('crmRecordType', typeof values.crmRecordType === 'string' ? values.crmRecordType : undefined)
  const personCrm = typeof values.crmRecordType === 'string' ? values.crmRecordType : 'customer'
  if (personCrm === 'partner' || personCrm === 'referrer') {
    assign('referralCode', typeof values.referralCode === 'string' ? values.referralCode : undefined)
  }
  assign(
    'companyEntityId',
    typeof values.companyEntityId === 'string'
      ? values.companyEntityId
      : values.companyEntityId === null
        ? null
        : undefined,
  )
  assign('description', typeof values.description === 'string' ? values.description : undefined)

  const peselDigits = normalizePeselDigits(typeof values.pesel === 'string' ? values.pesel : undefined)
  if (peselDigits) {
    if (!isValidPesel(peselDigits)) {
      throw new Error('PESEL_INVALID')
    }
    payload.pesel = peselDigits
  } else if (typeof values.pesel === 'string' && values.pesel.trim() === '') {
    payload.pesel = null
  }
  assign('residenceStreet', typeof values.residenceStreet === 'string' ? values.residenceStreet : undefined)
  assign('residencePostalCode', typeof values.residencePostalCode === 'string' ? values.residencePostalCode : undefined)
  assign('residenceCity', typeof values.residenceCity === 'string' ? values.residenceCity : undefined)
  const rc = typeof values.residenceCountry === 'string' ? values.residenceCountry.trim().toUpperCase() : undefined
  if (rc !== undefined) {
    if (rc === '') payload.residenceCountry = null
    else payload.residenceCountry = rc
  }

  const customFields = collectCustomFieldValues(values, {
    transform: (value) => normalizeCustomFieldSubmitValue(value),
  })
  if (Object.keys(customFields).length) {
    payload.customFields = customFields
  }

  if (organizationId) payload.organizationId = organizationId

  return payload
}

export const createCompanyFormSchema = () =>
  z
    .object({
      displayName: z.string().trim().min(1),
      primaryEmail: z
        .string()
        .trim()
        .email()
        .optional()
        .or(z.literal(''))
        .transform((val) => (val === '' ? undefined : val)),
      primaryPhone: z
        .string()
        .trim()
        .max(50)
        .refine((value) => isValidPhoneNumber(value), { message: CUSTOMER_PHONE_INVALID_MESSAGE_KEY })
        .optional()
        .or(z.literal(''))
        .transform((val) => (val === '' ? undefined : val))
        .optional(),
      status: z
        .string()
        .trim()
        .optional()
        .or(z.literal(''))
        .transform((val) => (val === '' ? undefined : val))
        .optional(),
      lifecycleStage: z
        .string()
        .trim()
        .optional()
        .or(z.literal(''))
        .transform((val) => (val === '' ? undefined : val))
        .optional(),
      source: z
        .string()
        .trim()
        .optional()
        .or(z.literal(''))
        .transform((val) => (val === '' ? undefined : val))
        .optional(),
      legalName: z
        .string()
        .trim()
        .optional()
        .or(z.literal(''))
        .transform((val) => (val === '' ? undefined : val))
        .optional(),
      brandName: z
        .string()
        .trim()
        .optional()
        .or(z.literal(''))
        .transform((val) => (val === '' ? undefined : val))
        .optional(),
      domain: z
        .string()
        .trim()
        .optional()
        .or(z.literal(''))
        .transform((val) => (val === '' ? undefined : val))
        .optional(),
      websiteUrl: z
        .string()
        .trim()
        .url()
        .optional()
        .or(z.literal(''))
        .transform((val) => (val === '' ? undefined : val))
        .optional(),
      industry: z
        .string()
        .trim()
        .optional()
        .or(z.literal(''))
        .transform((val) => (val === '' ? undefined : val))
        .optional(),
      sizeBucket: z
        .string()
        .trim()
        .optional()
        .or(z.literal(''))
        .transform((val) => (val === '' ? undefined : val))
        .optional(),
      annualRevenue: z
        .string()
        .trim()
        .optional()
        .or(z.literal(''))
        .transform((val) => (val === '' ? undefined : val))
        .optional(),
      crmRecordType: z.enum(['customer', 'partner', 'referrer']).optional(),
      referralCode: z
        .string()
        .trim()
        .optional()
        .or(z.literal(''))
        .transform((val) => (val === '' ? undefined : val))
        .optional(),
      nip: z
        .string()
        .trim()
        .optional()
        .or(z.literal(''))
        .transform((val) => (val === '' ? undefined : val))
        .optional(),
      regon: z
        .string()
        .trim()
        .optional()
        .or(z.literal(''))
        .transform((val) => (val === '' ? undefined : val))
        .optional(),
    })
    .superRefine((data, ctx) => {
      const rawNip = data.nip
      if (rawNip !== undefined && rawNip !== '') {
        const digits = normalizeNipDigits(String(rawNip))
        if (!digits || digits.length !== 10 || !isValidNip(digits)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['nip'],
            message: 'Invalid NIP',
          })
        }
      }
      const rawRegon = data.regon
      if (rawRegon !== undefined && rawRegon !== '') {
        const digits = normalizeRegonDigits(String(rawRegon))
        if (!digits || !isValidRegon(digits)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['regon'],
            message: 'Invalid REGON',
          })
        }
      }
    })
    .passthrough()

export type CompanyFormFieldOptions = {
  companySyncApplyRef?: React.MutableRefObject<((patch: Record<string, unknown>) => void) | null>
}

export const createCompanyFormFields = (t: Translator, options?: CompanyFormFieldOptions): CrudField[] => {
  const dictionaryFields: CrudField[] = companyDictionaryFieldDefinitions.map((definition) => ({
    id: definition.id,
    label: t(definition.labelKey),
    type: 'custom',
    layout: definition.layout ?? 'third',
    component: ({ value, setValue }: CrudCustomFieldRenderProps) => (
      <DictionarySelectField
        kind={definition.kind}
        value={typeof value === 'string' ? value : undefined}
        onChange={(next) => setValue(next)}
        labels={buildDictionaryLabels(t, definition)}
      />
    ),
  }))

  return [
    {
      id: 'displayName',
      label: t('customers.companies.form.displayName.label', 'Display name'),
      type: 'text',
      required: true,
    },
    {
      id: 'primaryEmail',
      label: t('customers.companies.detail.highlights.primaryEmail', 'Primary email'),
      type: 'text',
      layout: 'half',
      placeholder: t('customers.companies.form.primaryEmailPlaceholder', 'name@example.com'),
    },
    {
      id: 'primaryPhone',
      label: t('customers.companies.detail.highlights.primaryPhone', 'Primary phone'),
      type: 'custom',
      layout: 'half',
      component: ({ value, setValue, error, disabled, autoFocus }: CrudCustomFieldRenderProps) => (
        <PhoneNumberField
          value={typeof value === 'string' ? value : null}
          onValueChange={(next) => setValue(typeof next === 'string' ? next : undefined)}
          externalError={error}
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={t('customers.companies.form.primaryPhonePlaceholder', '+1 555 123 4567')}
          invalidLabel={t('customers.people.form.primaryPhone.invalid', 'Enter a valid phone number with country code (e.g. +1 212 555 1234)')}
          minDigits={7}
        />
      ),
    } as CrudField,
    ...dictionaryFields,
    {
      id: 'legalName',
      label: t('customers.companies.detail.fields.legalName', 'Legal name'),
      type: 'text',
      layout: 'half',
    },
    {
      id: 'brandName',
      label: t('customers.companies.detail.fields.brandName', 'Brand name'),
      type: 'text',
      layout: 'half',
    },
    {
      id: 'nip',
      label: t('customers.companies.form.nip', 'NIP'),
      type: 'custom',
      layout: 'half',
      placeholder: t('customers.companies.form.nipPlaceholder', '10-digit tax number'),
      component: ({ value, setValue, disabled, error }) => {
        const raw = typeof value === 'string' ? value : ''
        const digits = raw.trim().length ? normalizeNipDigits(raw) : null
        const liveInvalid =
          raw.trim().length > 0 && (!digits || digits.length !== 10 || !isValidNip(digits))
        const liveMessage = liveInvalid
          ? t('customers.companies.form.nipInvalid', 'Invalid NIP.')
          : null
        return (
          <div className="space-y-1">
            <input
              className={cnTw(CRUD_FORM_TEXT_INPUT_CLASS, (liveMessage || error) && 'border-destructive')}
              value={raw}
              onChange={(e) => setValue(e.target.value)}
              disabled={disabled}
              placeholder={t('customers.companies.form.nipPlaceholder', '10-digit tax number')}
              data-crud-focus-target=""
            />
            {liveMessage ? <p className="text-sm text-destructive">{liveMessage}</p> : null}
          </div>
        )
      },
    },
    {
      id: 'regon',
      label: t('customers.companies.form.regon', 'REGON'),
      type: 'custom',
      layout: 'half',
      placeholder: t('customers.companies.form.regonPlaceholder', '9 or 14 digits'),
      component: ({ value, setValue, disabled, error }) => {
        const raw = typeof value === 'string' ? value : ''
        const digits = raw.trim().length ? normalizeRegonDigits(raw) : null
        const liveInvalid =
          raw.trim().length > 0 && (!digits || !isValidRegon(digits))
        const liveMessage = liveInvalid
          ? t('customers.companies.form.regonInvalid', 'Invalid REGON.')
          : null
        return (
          <div className="space-y-1">
            <input
              className={cnTw(CRUD_FORM_TEXT_INPUT_CLASS, (liveMessage || error) && 'border-destructive')}
              value={raw}
              onChange={(e) => setValue(e.target.value)}
              disabled={disabled}
              placeholder={t('customers.companies.form.regonPlaceholder', '9 or 14 digits')}
              data-crud-focus-target=""
            />
            {liveMessage ? <p className="text-sm text-destructive">{liveMessage}</p> : null}
          </div>
        )
      },
    },
    {
      id: 'domain',
      label: t('customers.companies.detail.fields.domain', 'Domain'),
      type: 'text',
      layout: 'half',
      placeholder: t('customers.companies.detail.fields.domainPlaceholder', 'example.com'),
      description: t('customers.companies.detail.fields.domainHelp', 'Use a plain domain like example.com.'),
    },
    {
      id: 'websiteUrl',
      label: t('customers.companies.detail.highlights.website', 'Website'),
      type: 'text',
      layout: 'half',
      placeholder: t('customers.companies.detail.highlights.websitePlaceholder', 'https://example.com'),
      description: t('customers.companies.detail.fields.websiteHelp', 'Use a full URL like https://example.com.'),
    },
    {
      id: 'industry',
      label: t('customers.companies.detail.highlights.industry', 'Industry'),
      type: 'text',
      layout: 'half',
    },
    {
      id: 'sizeBucket',
      label: t('customers.companies.detail.fields.sizeBucket', 'Company size'),
      type: 'text',
      layout: 'half',
    },
    {
      id: 'annualRevenue',
      label: t('customers.companies.detail.highlights.annualRevenue', 'Annual revenue'),
      type: 'text',
      layout: 'half',
      placeholder: t('customers.companies.detail.highlights.annualRevenuePlaceholder', 'Enter amount'),
    },
    createCrmRecordTypeAndReferralField(t, 'company'),
    {
      id: 'description',
      label: t('customers.companies.detail.fields.description', 'Description'),
      type: 'textarea',
    },
    {
      id: 'addresses',
      label: '',
      type: 'custom',
      layout: 'full',
      component: ({ value, setValue }: CrudCustomFieldRenderProps) => {
        const addresses = Array.isArray(value) ? (value as CustomerAddressValue[]) : []
        return (
          <CustomerAddressTiles
            addresses={addresses}
            t={t}
            emptyLabel={t('customers.companies.detail.empty.addresses')}
            gridClassName="grid gap-4 min-[480px]:grid-cols-1 xl:grid-cols-2"
            onCreate={async (payload: CustomerAddressInput) => {
              const nextId =
                typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                  ? crypto.randomUUID()
                  : `tmp-${Math.random().toString(36).slice(2)}`
              const next: CustomerAddressValue = {
                id: nextId,
                name: payload.name ?? undefined,
                purpose: payload.purpose ?? undefined,
                companyName: payload.companyName ?? undefined,
                addressLine1: payload.addressLine1,
                addressLine2: payload.addressLine2 ?? undefined,
                buildingNumber: payload.buildingNumber ?? undefined,
                flatNumber: payload.flatNumber ?? undefined,
                city: payload.city ?? undefined,
                region: payload.region ?? undefined,
                postalCode: payload.postalCode ?? undefined,
                country: payload.country ?? undefined,
                isPrimary: payload.isPrimary ?? false,
              }
              const current = Array.isArray(addresses) ? addresses : []
              const nextAddresses =
                next.isPrimary === true
                  ? [next, ...current.map((item) => ({ ...item, isPrimary: false }))]
                  : [next, ...current]
              setValue(nextAddresses)
            }}
            onUpdate={async (id, payload) => {
              const current = Array.isArray(addresses) ? addresses : []
              const updated = current.map((item) => {
                if (item.id !== id) {
                  return payload.isPrimary ? { ...item, isPrimary: false } : item
                }
                return {
                  ...item,
                  name: payload.name ?? null,
                  purpose: payload.purpose ?? null,
                  companyName: payload.companyName ?? null,
                  addressLine1: payload.addressLine1,
                  addressLine2: payload.addressLine2 ?? null,
                  buildingNumber: payload.buildingNumber ?? null,
                  flatNumber: payload.flatNumber ?? null,
                  city: payload.city ?? null,
                  region: payload.region ?? null,
                  postalCode: payload.postalCode ?? null,
                  country: payload.country ?? null,
                  isPrimary: payload.isPrimary ?? false,
                }
              })
              setValue(updated)
            }}
            onDelete={async (id) => {
              const current = Array.isArray(addresses) ? addresses : []
              setValue(current.filter((item) => item.id !== id))
            }}
          />
        )
      },
    },
    ...(options?.companySyncApplyRef ? [createCompanyRegistrySyncBridgeField(options.companySyncApplyRef)] : []),
  ]
}

export type CompanyFormGroupOptions = {
  includeRegistrySyncBridge?: boolean
}

export const createCompanyFormGroups = (t: Translator, groupOptions?: CompanyFormGroupOptions): CrudFormGroup[] => [
  {
    id: 'details',
    title: t('customers.companies.form.groups.details'),
    column: 1,
    fields: [
      'displayName',
      'primaryEmail',
      'primaryPhone',
      'status',
      'lifecycleStage',
      'source',
      'crmRecordType',
    ],
  },
  {
    id: 'profile',
    title: t('customers.companies.form.groups.profile'),
    column: 1,
    fields: [
      'legalName',
      'brandName',
      'nip',
      'regon',
      'domain',
      'websiteUrl',
      'industry',
      'sizeBucket',
      'annualRevenue',
      ...(groupOptions?.includeRegistrySyncBridge ? (['__companyRegistrySyncBridge'] as const) : []),
    ],
  },
  {
    id: 'addresses',
    title: t('customers.companies.form.groups.addresses'),
    column: 1,
    fields: ['addresses'],
  },
  {
    id: 'notes',
    title: t('customers.companies.form.groups.notes'),
    column: 2,
    fields: ['description'],
  },
  {
    id: 'customFields',
    title: t('customers.companies.form.groups.custom'),
    column: 2,
    kind: 'customFields',
  },
]

export function buildCompanyPayload(
  values: CompanyFormValues | CompanyEditFormValues,
  organizationId?: string | null,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  const displayNameValue = blankToUndefined(
    typeof values.displayName === 'string' ? values.displayName : undefined,
  )
  if (!displayNameValue) {
    throw new Error('DISPLAY_NAME_REQUIRED')
  }
  payload.displayName = displayNameValue

  const assign = (key: string, val?: string) => {
    const normalized = blankToUndefined(val)
    if (normalized !== undefined) payload[key] = normalized
  }

  assign('primaryEmail', typeof values.primaryEmail === 'string' ? values.primaryEmail : undefined)
  assign('primaryPhone', typeof values.primaryPhone === 'string' ? values.primaryPhone : undefined)
  assign('status', typeof values.status === 'string' ? values.status : undefined)
  assign('lifecycleStage', typeof values.lifecycleStage === 'string' ? values.lifecycleStage : undefined)
  assign('source', typeof values.source === 'string' ? values.source : undefined)
  assign('crmRecordType', typeof values.crmRecordType === 'string' ? values.crmRecordType : undefined)
  const companyCrm = typeof values.crmRecordType === 'string' ? values.crmRecordType : 'customer'
  if (companyCrm === 'partner' || companyCrm === 'referrer') {
    assign('referralCode', typeof values.referralCode === 'string' ? values.referralCode : undefined)
  }
  assign('legalName', typeof values.legalName === 'string' ? values.legalName : undefined)
  assign('brandName', typeof values.brandName === 'string' ? values.brandName : undefined)

  const nipDigits = normalizeNipDigits(typeof values.nip === 'string' ? values.nip : undefined)
  if (nipDigits) {
    if (!isValidNip(nipDigits)) {
      throw new Error('NIP_INVALID')
    }
    payload.nip = nipDigits
  } else if (typeof values.nip === 'string' && values.nip.trim() === '') {
    payload.nip = null
  }

  const regonDigits = normalizeRegonDigits(typeof values.regon === 'string' ? values.regon : undefined)
  if (regonDigits) {
    if (!isValidRegon(regonDigits)) {
      throw new Error('REGON_INVALID')
    }
    payload.regon = regonDigits
  } else if (typeof values.regon === 'string' && values.regon.trim() === '') {
    payload.regon = null
  }

  assign('domain', typeof values.domain === 'string' ? values.domain?.toLowerCase() : undefined)
  assign('websiteUrl', typeof values.websiteUrl === 'string' ? values.websiteUrl : undefined)
  assign('industry', typeof values.industry === 'string' ? values.industry : undefined)
  assign('sizeBucket', typeof values.sizeBucket === 'string' ? values.sizeBucket : undefined)
  assign('description', typeof values.description === 'string' ? values.description : undefined)

  const rawRevenue = typeof values.annualRevenue === 'string' ? values.annualRevenue.trim() : ''
  if (rawRevenue.length) {
    const normalized = rawRevenue.replace(/,/g, '').replace(/\s+/g, '')
    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
      throw new Error('ANNUAL_REVENUE_INVALID')
    }
    payload.annualRevenue = normalized
  }

  const customFields = collectCustomFieldValues(values, {
    transform: (value) => normalizeCustomFieldSubmitValue(value),
  })
  if (Object.keys(customFields).length) {
    payload.customFields = customFields
  }

  if (organizationId) payload.organizationId = organizationId

  return payload
}

// ---------------------------------------------------------------------------
// Edit-mode types
// ---------------------------------------------------------------------------

export type CompanyEditFormValues = Omit<CompanyFormValues, 'addresses'> & {
  id: string
}

export type PersonEditFormValues = Omit<PersonFormValues, 'addresses'> & {
  id: string
  department?: string
  linkedInUrl?: string
  twitterUrl?: string
}

// ---------------------------------------------------------------------------
// Edit-mode schemas
// ---------------------------------------------------------------------------

const optionalString = () =>
  z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .transform((val) => (val === '' ? undefined : val))
    .optional()

export const createCompanyEditSchema = () =>
  createCompanyFormSchema().extend({
    id: z.string().uuid(),
  })

export const createPersonEditSchema = () =>
  createPersonFormSchema().extend({
    id: z.string().uuid(),
    department: optionalString(),
    linkedInUrl: z
      .string()
      .trim()
      .url()
      .optional()
      .or(z.literal(''))
      .transform((val) => (val === '' ? undefined : val))
      .optional(),
    twitterUrl: z
      .string()
      .trim()
      .url()
      .optional()
      .or(z.literal(''))
      .transform((val) => (val === '' ? undefined : val))
      .optional(),
  })

// ---------------------------------------------------------------------------
// Edit-mode fields
// ---------------------------------------------------------------------------

const buildIndustryLabels = (t: Translator): DictionarySelectLabels => ({
  placeholder: t('customers.companies.form.industry.placeholder', 'Select industry…'),
  addLabel: t('customers.companies.form.dictionary.addIndustry', 'Add industry'),
  addPrompt: t('customers.companies.form.dictionary.promptIndustry', 'Enter a new industry.'),
  dialogTitle: t('customers.companies.form.dictionary.dialogTitleIndustry', 'Add industry'),
  valueLabel: t('customers.people.form.dictionary.valueLabel', 'Value'),
  valuePlaceholder: t('customers.people.form.dictionary.valuePlaceholder', 'Value'),
  labelLabel: t('customers.config.dictionaries.dialog.labelLabel', 'Label'),
  labelPlaceholder: t('customers.people.form.dictionary.labelPlaceholder', 'Display name shown in UI'),
  emptyError: t('customers.people.form.dictionary.errorRequired'),
  cancelLabel: t('customers.people.form.dictionary.cancel'),
  saveLabel: t('customers.people.form.dictionary.save'),
  successCreateLabel: undefined,
  errorLoad: t('customers.people.form.dictionary.errorLoad'),
  errorSave: t('customers.people.form.dictionary.error'),
  loadingLabel: t('customers.people.form.dictionary.loading'),
  manageTitle: t('customers.people.form.dictionary.manage'),
})

export const createCompanyEditFields = (t: Translator): CrudField[] => {
  const baseFields = createCompanyFormFields(t)
  const industryLabels = buildIndustryLabels(t)

  return baseFields.map((field) => {
    if (field.id === 'industry') {
      return {
        id: 'industry',
        label: t('customers.companies.detail.fields.industry', 'Industry'),
        type: 'custom',
        layout: 'half',
        component: ({ value, setValue }: CrudCustomFieldRenderProps) => (
          <DictionarySelectField
            kind={'industries' as CustomerDictionaryKind}
            value={typeof value === 'string' ? value : undefined}
            onChange={(next) => setValue(next)}
            labels={industryLabels}
          />
        ),
      } as CrudField
    }
    return field
  })
}

export const createPersonEditFields = (t: Translator): CrudField[] => {
  const baseFields = createPersonFormFields(t)
  return [
    ...baseFields,
    {
      id: 'department',
      label: t('customers.people.form.department', 'Department'),
      type: 'text',
      layout: 'half',
    },
    {
      id: 'linkedInUrl',
      label: t('customers.people.form.linkedInUrl', 'LinkedIn URL'),
      type: 'text',
      layout: 'half',
      placeholder: t('customers.people.form.linkedInUrl.placeholder', 'https://linkedin.com/in/...'),
    },
    {
      id: 'twitterUrl',
      label: t('customers.people.form.twitterUrl', 'Twitter / X URL'),
      type: 'text',
      layout: 'half',
      placeholder: t('customers.people.form.twitterUrl.placeholder', 'https://x.com/...'),
    },
  ]
}

// ---------------------------------------------------------------------------
// Edit-mode groups
// ---------------------------------------------------------------------------

export const createCompanyEditGroups = (t: Translator): CrudFormGroup[] => [
  {
    id: 'details',
    title: t('customers.companies.form.groups.details'),
    column: 1,
    fields: ['displayName', 'primaryEmail', 'primaryPhone', 'status', 'lifecycleStage', 'source'],
  },
  {
    id: 'profile',
    title: t('customers.companies.form.groups.profile'),
    column: 1,
    fields: ['legalName', 'brandName', 'domain', 'websiteUrl', 'industry', 'sizeBucket', 'annualRevenue'],
  },
  {
    id: 'notes',
    title: t('customers.companies.form.groups.notes'),
    column: 2,
    fields: ['description'],
  },
  {
    id: 'customFields',
    title: t('customers.companies.form.groups.custom'),
    column: 2,
    kind: 'customFields',
  },
]

export const createPersonEditGroups = (t: Translator): CrudFormGroup[] => [
  {
    id: 'details',
    title: t('customers.people.form.groups.details'),
    column: 1,
    fields: [
      'firstName',
      'lastName',
      '__contactInformationSection',
      'primaryEmail',
      'primaryPhone',
      '__companyInformationSection',
      'jobTitle',
      'companyEntityId',
      'status',
      'lifecycleStage',
      'source',
    ],
    component: createDisplayNameSection(t),
  },
  {
    id: 'social',
    title: t('customers.people.form.groups.social', 'Social & links'),
    column: 1,
    fields: ['department', 'linkedInUrl', 'twitterUrl'],
  },
  {
    id: 'notes',
    title: t('customers.people.form.groups.notes'),
    column: 2,
    fields: ['description'],
  },
  {
    id: 'customFields',
    title: t('customers.people.form.groups.custom'),
    column: 2,
    kind: 'customFields',
  },
]

// ---------------------------------------------------------------------------
// Edit-mode payload builders
// ---------------------------------------------------------------------------

export function buildCompanyEditPayload(values: CompanyEditFormValues, organizationId?: string | null): Record<string, unknown> {
  const payload = buildCompanyPayload(values, organizationId)
  payload.id = values.id
  return payload
}

export function buildPersonEditPayload(values: PersonEditFormValues, organizationId?: string | null): Record<string, unknown> {
  const payload = buildPersonPayload(values, organizationId)
  payload.id = values.id

  const department = typeof values.department === 'string' ? values.department.trim() : ''
  if (department.length) payload.department = department

  const linkedInUrl = typeof values.linkedInUrl === 'string' ? values.linkedInUrl.trim() : ''
  if (linkedInUrl.length) payload.linkedInUrl = linkedInUrl

  const twitterUrl = typeof values.twitterUrl === 'string' ? values.twitterUrl.trim() : ''
  if (twitterUrl.length) payload.twitterUrl = twitterUrl

  return payload
}

// ---------------------------------------------------------------------------
// Overview types (shared between v1 and v2 detail pages)
// ---------------------------------------------------------------------------

import type {
  TagSummary,
  CommentSummary,
  ActivitySummary,
  DealSummary,
  TodoLinkSummary,
  InteractionSummary,
} from './detail/types'

export type { TagSummary, CommentSummary, ActivitySummary, DealSummary, TodoLinkSummary, InteractionSummary }

export type CompanyPersonSummary = {
  id: string
  displayName: string
  primaryEmail?: string | null
  jobTitle?: string | null
}

export type CompanyOverview = {
  company: {
    id: string
    displayName: string
    description?: string | null
    ownerUserId?: string | null
    primaryEmail?: string | null
    primaryPhone?: string | null
    status?: string | null
    lifecycleStage?: string | null
    source?: string | null
    nextInteractionAt?: string | null
    nextInteractionName?: string | null
    nextInteractionRefId?: string | null
    nextInteractionIcon?: string | null
    nextInteractionColor?: string | null
    organizationId?: string | null
  }
  profile: {
    id: string
    legalName?: string | null
    brandName?: string | null
    domain?: string | null
    websiteUrl?: string | null
    industry?: string | null
    sizeBucket?: string | null
    annualRevenue?: string | null
  } | null
  customFields: Record<string, unknown>
  tags: TagSummary[]
  comments: CommentSummary[]
  activities: ActivitySummary[]
  interactions: InteractionSummary[]
  deals: DealSummary[]
  todos: TodoLinkSummary[]
  people: CompanyPersonSummary[]
  interactionMode?: 'canonical' | 'legacy'
  viewer?: {
    userId: string | null
    name?: string | null
    email?: string | null
  } | null
}

export type PersonOverview = {
  person: {
    id: string
    displayName: string
    description?: string | null
    ownerUserId?: string | null
    primaryEmail?: string | null
    primaryPhone?: string | null
    status?: string | null
    lifecycleStage?: string | null
    source?: string | null
    nextInteractionAt?: string | null
    nextInteractionName?: string | null
    nextInteractionRefId?: string | null
    nextInteractionIcon?: string | null
    nextInteractionColor?: string | null
    organizationId?: string | null
  }
  profile: {
    id: string
    firstName?: string | null
    lastName?: string | null
    preferredName?: string | null
    jobTitle?: string | null
    department?: string | null
    seniority?: string | null
    timezone?: string | null
    linkedInUrl?: string | null
    twitterUrl?: string | null
    companyEntityId?: string | null
  } | null
  customFields: Record<string, unknown>
  tags: TagSummary[]
  comments: CommentSummary[]
  activities: ActivitySummary[]
  interactions: InteractionSummary[]
  deals: DealSummary[]
  todos: TodoLinkSummary[]
  interactionMode?: 'canonical' | 'legacy'
  company?: {
    id: string
    displayName: string
  } | null
  viewer?: {
    userId: string | null
    name?: string | null
    email?: string | null
  } | null
}

// ---------------------------------------------------------------------------
// API response → form values mapping
// ---------------------------------------------------------------------------

export function mapCompanyOverviewToFormValues(overview: CompanyOverview): Partial<CompanyEditFormValues> {
  const rawPhone = overview.company.primaryPhone
  const phoneValue = rawPhone == null ? '' : String(rawPhone)
  return {
    id: overview.company.id,
    displayName: overview.company.displayName,
    primaryEmail: overview.company.primaryEmail ?? '',
    primaryPhone: phoneValue,
    status: overview.company.status ?? '',
    lifecycleStage: overview.company.lifecycleStage ?? '',
    source: overview.company.source ?? '',
    description: overview.company.description ?? '',
    legalName: overview.profile?.legalName ?? '',
    brandName: overview.profile?.brandName ?? '',
    domain: overview.profile?.domain ?? '',
    websiteUrl: overview.profile?.websiteUrl ?? '',
    industry: overview.profile?.industry ?? '',
    sizeBucket: overview.profile?.sizeBucket ?? '',
    annualRevenue: overview.profile?.annualRevenue ?? '',
    ...overview.customFields,
  }
}

export function mapPersonOverviewToFormValues(overview: PersonOverview): Partial<PersonEditFormValues> {
  const rawPhone = overview.person.primaryPhone
  const phoneValue = rawPhone == null ? '' : String(rawPhone)
  return {
    id: overview.person.id,
    displayName: overview.person.displayName,
    firstName: overview.profile?.firstName ?? '',
    lastName: overview.profile?.lastName ?? '',
    primaryEmail: overview.person.primaryEmail ?? '',
    primaryPhone: phoneValue,
    companyEntityId: overview.profile?.companyEntityId ?? '',
    jobTitle: overview.profile?.jobTitle ?? '',
    status: overview.person.status ?? '',
    lifecycleStage: overview.person.lifecycleStage ?? '',
    source: overview.person.source ?? '',
    description: overview.person.description ?? '',
    department: overview.profile?.department ?? '',
    linkedInUrl: overview.profile?.linkedInUrl ?? '',
    twitterUrl: overview.profile?.twitterUrl ?? '',
    ...overview.customFields,
  }
}
