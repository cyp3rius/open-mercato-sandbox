"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Button } from '@open-mercato/ui/primitives/button'
import { Spinner } from '@open-mercato/ui/primitives/spinner'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCallOrThrow, readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { collectCustomFieldValues } from '@open-mercato/ui/backend/utils/customFieldValues'
import { mapCrudServerErrorToFormErrors } from '@open-mercato/ui/backend/utils/serverErrors'
import { E } from '#generated/entities.ids.generated'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import {
  ActivitiesSection,
} from '../../../../components/detail/ActivitiesSection'
import {
  NotesSection,
  type CommentSummary,
  InlineSelectEditor,
  } from '@open-mercato/ui/backend/detail'
import {
  TagsSection,
  type TagOption,
} from '../../../../components/detail/TagsSection'
import { DealsSection } from '../../../../components/detail/DealsSection'
import { AddressesSection } from '../../../../components/detail/AddressesSection'
import { TasksSection } from '../../../../components/detail/TasksSection'
import { PersonHighlights } from '../../../../components/detail/PersonHighlights'
import {
  renderLinkedInDisplay,
  renderTwitterDisplay,
  renderMultilineMarkdownDisplay,
  InlineDictionaryEditor,
} from '../../../../components/detail/InlineEditors'
import { DetailFieldsSection, type DetailFieldConfig } from '@open-mercato/ui/backend/detail'
import { isValidSocialUrl } from '@open-mercato/core/modules/customers/lib/detailHelpers'
import { isValidPesel, normalizePeselDigits } from '@open-mercato/core/modules/customers/lib/pesel'
import type { ActivitySummary, DealSummary, TagSummary, TodoLinkSummary } from '../../../../components/detail/types'
import { CustomDataSection } from '../../../../components/detail/CustomDataSection'
import { createTranslatorWithFallback } from '@open-mercato/shared/lib/i18n/translate'
import { normalizeCustomFieldSubmitValue } from '../../../../components/detail/customFieldUtils'
import { renderDictionaryColor, renderDictionaryIcon } from '@open-mercato/core/modules/dictionaries/components/dictionaryAppearance'
import { ICON_SUGGESTIONS } from '../../../../lib/dictionaries'
import { createCustomerNotesAdapter } from '../../../../components/detail/notesAdapter'
import { readMarkdownPreferenceCookie, writeMarkdownPreferenceCookie } from '../../../../lib/markdownPreference'
import { InjectionSpot, useInjectionWidgets } from '@open-mercato/ui/backend/injection/InjectionSpot'
import { DetailTabsLayout } from '../../../../components/detail/DetailTabsLayout'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { SendObjectMessageDialog } from '@open-mercato/ui/backend/messages'
import { EntitySearchCombobox } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import {
  mergeEntitySearchOption,
  remoteSearchAuthUsers,
  resolveUserDisplayLabel,
} from '../../../../../procurement/lib/procurementEntitySearch'
import {
  buildCustomerDetailTabDefinitions,
  resolveCustomerDetailTab,
} from '../../../../components/detail/customerEntityDetailTabs'
import { buildSimpleDealCreateHref } from '../../../../components/detail/customerEntityCreatePrefill'
import { CustomerEntityOrdersTab } from '../../../../components/detail/CustomerEntityOrdersTab'
import { CustomerEntityQuotesTab } from '../../../../components/detail/CustomerEntityQuotesTab'
import { CustomerEntityCasesTab } from '../../../../components/detail/CustomerEntityCasesTab'
import { CustomerEntityPoliciesTab } from '../../../../components/detail/CustomerEntityPoliciesTab'
import { PersonResourcesSection } from '../../../../components/detail/PersonResourcesSection'

type PersonOverview = {
  person: {
    id: string
    displayName: string
    description?: string | null
    ownerUserId?: string | null
    ownerUserName?: string | null
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
    pesel?: string | null
    residenceStreet?: string | null
    residencePostalCode?: string | null
    residenceCity?: string | null
    residenceCountry?: string | null
  } | null
  customFields: Record<string, unknown>
  tags: TagSummary[]
  comments: CommentSummary[]
  activities: ActivitySummary[]
  deals: DealSummary[]
  todos: TodoLinkSummary[]
  viewer?: {
    userId: string | null
    name?: string | null
    email?: string | null
  } | null
}

type SectionKey = string

type ProfileEditableField =
  | 'firstName'
  | 'lastName'
  | 'jobTitle'
  | 'department'
  | 'linkedInUrl'
  | 'twitterUrl'
  | 'residenceStreet'
  | 'residencePostalCode'
  | 'residenceCity'
  | 'residenceCountry'


export default function CustomerPersonDetailPage({ params }: { params?: { id?: string } }) {
  const id = params?.id
  const t = useT()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const detailTranslator = React.useMemo(() => createTranslatorWithFallback(t), [t])
  const notesAdapter = React.useMemo(() => createCustomerNotesAdapter(detailTranslator), [detailTranslator])
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = React.useMemo(
    () => resolveCustomerDetailTab(searchParams?.get('tab')),
    [searchParams],
  )
  const [data, setData] = React.useState<PersonOverview | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [activeTab, setActiveTab] = React.useState<SectionKey>(initialTab)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [ownerLabel, setOwnerLabel] = React.useState<string | null>(null)

  React.useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  const validators = React.useMemo(() => ({
    email: (value: string) => {
      if (!value) return null
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return emailRegex.test(value) ? null : t('customers.people.detail.inline.emailInvalid')
    },
    phone: (value: string) => {
      if (!value) return null
      return value.length >= 3 ? null : t('customers.people.detail.inline.phoneInvalid')
    },
    displayName: (value: string) => {
      const trimmed = value.trim()
      return trimmed.length ? null : t('customers.people.form.displayName.error')
    },
    linkedInUrl: (value: string) => {
      if (!value) return null
      const candidate = value.trim()
      return isValidSocialUrl(candidate, { hosts: ['linkedin.com'], pathRequired: true })
        ? null
        : t('customers.people.detail.inline.linkedInInvalid')
    },
    twitterUrl: (value: string) => {
      if (!value) return null
      const candidate = value.trim()
      return isValidSocialUrl(candidate, { hosts: ['twitter.com', 'x.com'], pathRequired: true })
        ? null
        : t('customers.people.detail.inline.twitterInvalid')
    },
    pesel: (value: string) => {
      if (!value?.trim()) return null
      const digits = normalizePeselDigits(value)
      if (!digits || digits.length !== 11 || !isValidPesel(digits)) {
        return t('customers.people.form.peselInvalid')
      }
      return null
    },
    residenceCountry: (value: string) => {
      if (!value?.trim()) return null
      const u = value.trim().toUpperCase()
      return /^[A-Z]{2}$/.test(u) ? null : t('customers.people.form.residenceCountryInvalid')
    },
  }), [t])

  const personId = data?.person?.id ?? null
  const ownerUserId = data?.person?.ownerUserId?.trim() ?? ''
  const ownerUserNameFromApi = data?.person?.ownerUserName?.trim() || null
  React.useEffect(() => {
    if (!ownerUserId) {
      setOwnerLabel(null)
      return
    }
    if (ownerUserNameFromApi) {
      setOwnerLabel(ownerUserNameFromApi)
      return
    }
    let cancelled = false
    resolveUserDisplayLabel(ownerUserId)
      .then((label) => {
        if (!cancelled) setOwnerLabel(label)
      })
      .catch(() => {
        if (!cancelled) setOwnerLabel(null)
      })
    return () => {
      cancelled = true
    }
  }, [ownerUserId, ownerUserNameFromApi])
  const ownerOptions = React.useMemo(
    () => mergeEntitySearchOption([], ownerUserId, ownerLabel ?? ownerUserId),
    [ownerLabel, ownerUserId],
  )
  const mutationContextId = React.useMemo(
    () => (personId ? `customer-person:${personId}` : `customer-person:${id ?? 'pending'}`),
    [id, personId],
  )
  const { runMutation, retryLastMutation } = useGuardedMutation<{
    formId: string
    personId?: string | null
    resourceKind: string
    resourceId?: string
    data: PersonOverview | null
    retryLastMutation: () => Promise<boolean>
  }>({
    contextId: mutationContextId,
    blockedMessage: t('ui.forms.flash.saveBlocked', 'Save blocked by validation'),
  })
  const injectionContext = React.useMemo(
    () => ({
      formId: mutationContextId,
      personId,
      resourceKind: 'customers.person',
      resourceId: personId ?? (id ?? undefined),
      data,
      retryLastMutation,
    }),
    [data, id, mutationContextId, personId, retryLastMutation],
  )
  const runMutationWithContext = React.useCallback(
    async <T,>(operation: () => Promise<T>, mutationPayload?: Record<string, unknown>): Promise<T> => {
      return runMutation({
        operation,
        mutationPayload,
        context: injectionContext,
      })
    },
    [injectionContext, runMutation],
  )
  const { widgets: injectedTabWidgets } = useInjectionWidgets('customers.person.detail:tabs', {
    context: injectionContext,
    triggerOnLoad: true,
  })
  const injectedTabs = React.useMemo(
    () =>
      (injectedTabWidgets ?? [])
        .filter((widget) => (widget.placement?.kind ?? 'tab') === 'tab')
        .map((widget) => {
          const id = widget.placement?.groupId ?? widget.widgetId
          const labelKey = widget.placement?.groupLabel ?? widget.module.metadata.title
          const label =
            typeof labelKey === 'string' && labelKey.includes('.')
              ? t(labelKey, widget.module.metadata.title)
              : labelKey
          const priority = typeof widget.placement?.priority === 'number' ? widget.placement.priority : 0
          const render = () => (
            <widget.module.Widget
              context={injectionContext}
              data={data}
              onDataChange={(next) => setData(next as PersonOverview)}
            />
          )
          return { id, label, priority, render }
        })
        .sort((a, b) => b.priority - a.priority),
    [data, injectedTabWidgets, injectionContext, t],
  )
  const injectedTabMap = React.useMemo(() => new Map(injectedTabs.map((tab) => [tab.id, tab.render])), [injectedTabs])

  const tabs = React.useMemo(
    () =>
      buildCustomerDetailTabDefinitions({
        kind: 'person',
        t,
        i18nPrefix: 'customers.people.detail',
        injectedTabs: injectedTabs.map((tab) => ({ id: tab.id, label: tab.label })),
      }),
    [injectedTabs, t],
  )

  const personName = React.useMemo(
    () => (data?.person?.displayName ? data.person.displayName : t('customers.people.list.deleteFallbackName')),
    [data?.person?.displayName, t]
  )

  const dealsScope = React.useMemo(
    () => (personId ? ({ kind: 'person', entityId: personId } as const) : null),
    [personId],
  )

  const dealCreateHref = React.useMemo(
    () =>
      personId
        ? buildSimpleDealCreateHref({
            customerEntityId: personId,
            ownerUserId: data?.person?.ownerUserId ?? null,
            kind: 'person',
          })
        : null,
    [data?.person?.ownerUserId, personId],
  )
  const dealSelectOptions = React.useMemo(
    () =>
      Array.isArray(data?.deals)
        ? data.deals
            .map((deal) => {
              if (!deal || typeof deal !== 'object') return null
              const record = deal as Record<string, unknown>
              const id = typeof record.id === 'string' ? record.id : ''
              if (!id) return null
              const rawTitle = typeof record.title === 'string' ? record.title.trim() : ''
              const label = rawTitle.length ? rawTitle : id
              return { id, label }
            })
            .filter((option): option is { id: string; label: string } => option !== null)
        : [],
    [data?.deals],
  )
  const handleNotesLoadingChange = React.useCallback(() => {}, [])

  const handleActivitiesLoadingChange = React.useCallback(() => {}, [])

  const handleDealsLoadingChange = React.useCallback(() => {}, [])

  const handleAddressesLoadingChange = React.useCallback(() => {}, [])

  const handleTasksLoadingChange = React.useCallback(() => {}, [])

  React.useEffect(() => {
    if (!id) {
      setError(t('customers.people.detail.error.notFound'))
      setIsLoading(false)
      return
    }
    const personId = id
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const payload = await readApiResultOrThrow<PersonOverview>(
          `/api/customers/people/${encodeURIComponent(personId)}?include=todos`,
          undefined,
          { errorMessage: t('customers.people.detail.error.load') },
        )
        if (cancelled) return
        setData(payload as PersonOverview)
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : t('customers.people.detail.error.load')
        setError(message)
        setData(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [id, t])

  const savePerson = React.useCallback(
    async (patch: Record<string, unknown>, apply: (prev: PersonOverview) => PersonOverview) => {
      if (!data) return
      const payload = { id: data.person.id, ...patch }
      await runMutationWithContext(
        () => apiCallOrThrow(
          '/api/customers/people',
          {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          },
          { errorMessage: t('customers.people.detail.inline.error') },
        ),
        payload,
      )
      setData((prev) => (prev ? apply(prev) : prev))
    },
    [data, runMutationWithContext, t]
  )

  const updateDisplayName = React.useCallback(
    async (next: string | null) => {
      const send = typeof next === 'string' ? next : ''
      await savePerson(
        { displayName: send },
        (prev) => ({
          ...prev,
          person: {
            ...prev.person,
            displayName: next && next.length ? next : prev.person.displayName,
          },
        })
      )
    },
    [savePerson]
  )

  const updateOwnerUser = React.useCallback(
    async (next: string | null) => {
      const normalized = typeof next === 'string' ? next.trim() : ''
      if (!normalized) throw new Error(t('customers.form.ownerRequired', 'Guardian is required.'))
      const knownLabel = ownerOptions.find((option) => option.value === normalized)?.label
      if (knownLabel && knownLabel !== normalized) setOwnerLabel(knownLabel)
      await savePerson(
        { ownerUserId: normalized },
        (prev) => ({
          ...prev,
          person: {
            ...prev.person,
            ownerUserId: normalized,
            ownerUserName: knownLabel && knownLabel !== normalized ? knownLabel : null,
          },
        }),
      )
      if (!knownLabel || knownLabel === normalized) {
        const resolved = await resolveUserDisplayLabel(normalized)
        if (resolved) setOwnerLabel(resolved)
      }
    },
    [ownerOptions, savePerson, t],
  )

  const updateProfileField = React.useCallback(
    async (field: ProfileEditableField, next: string | null) => {
      const send = typeof next === 'string' ? next : ''
      await savePerson(
        { [field]: send },
        (prev) => {
          if (!prev.profile) return prev
          const nextValue = next && next.length ? next : null
          return {
            ...prev,
            profile: {
              ...prev.profile,
              [field]: nextValue,
            },
          }
        }
      )
    },
    [savePerson]
  )

  const handleDelete = React.useCallback(async () => {
    if (!personId) return
    const confirmed = await confirm({
      title: t('customers.people.list.deleteConfirm', undefined, { name: personName }),
      variant: 'destructive',
    })
    if (!confirmed) return
    setIsDeleting(true)
    try {
      await runMutationWithContext(
        () => apiCallOrThrow(
          `/api/customers/people?id=${encodeURIComponent(personId)}`,
          {
            method: 'DELETE',
            headers: { 'content-type': 'application/json' },
          },
          { errorMessage: t('customers.people.list.deleteError') },
        ),
        { id: personId },
      )
      flash(t('customers.people.list.deleteSuccess'), 'success')
      router.push('/backend/customers/people')
    } catch (err) {
      const message = err instanceof Error ? err.message : t('customers.people.list.deleteError')
      flash(message, 'error')
    } finally {
      setIsDeleting(false)
    }
  }, [confirm, personId, personName, router, runMutationWithContext, t])

  const handleTagsChange = React.useCallback((nextTags: TagOption[]) => {
    setData((prev) => (prev ? { ...prev, tags: nextTags } : prev))
  }, [])
  
  const handleCustomFieldsSubmit = React.useCallback(
    async (values: Record<string, unknown>) => {
      if (!data) {
        throw new Error(t('customers.people.detail.inline.error'))
      }
      const customPayload = collectCustomFieldValues(values, {
        transform: (value) => normalizeCustomFieldSubmitValue(value),
      })
      const prefixed: Record<string, unknown> = {}
      for (const [fieldId, value] of Object.entries(customPayload)) {
        prefixed[`cf_${fieldId}`] = value
      }
      if (!Object.keys(customPayload).length) {
        flash(t('ui.forms.flash.saveSuccess'), 'success')
        return
      }
      try {
        const payload = {
          id: data.person.id,
          customFields: customPayload,
        }
        await runMutationWithContext(
          () => apiCallOrThrow(
            '/api/customers/people',
            {
              method: 'PUT',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(payload),
            },
            { errorMessage: t('customers.people.detail.inline.error') },
          ),
          payload,
        )
      } catch (err) {
        const { message: helperMessage, fieldErrors } = mapCrudServerErrorToFormErrors(err)
        const mappedErrors = fieldErrors
          ? Object.entries(fieldErrors).reduce<Record<string, string>>((acc, [key, value]) => {
              const formKey = key.startsWith('cf_') ? key : `cf_${key}`
              acc[formKey] = value
              return acc
            }, {})
          : undefined
        const error = new Error(helperMessage ?? t('customers.people.detail.inline.error')) as Error & {
          fieldErrors?: Record<string, string>
        }
        if (mappedErrors && Object.keys(mappedErrors).length) error.fieldErrors = mappedErrors
        throw error
      }
      setData((prev) => {
        if (!prev) return prev
        const nextCustomFields = { ...prefixed }
        return { ...prev, customFields: nextCustomFields }
      })
        flash(t('ui.forms.flash.saveSuccess'), 'success')
      },
      [data, runMutationWithContext, t]
    )
  
    if (isLoading) {
      return (
        <Page>
          <PageBody>
            <div className="flex h-[50vh] flex-col items-center justify-center gap-2 text-muted-foreground">
              <Spinner className="h-6 w-6" />
              <span>{t('customers.people.detail.loading')}</span>
            </div>
          </PageBody>
        </Page>
      )
    }
  
    if (error || !data || !personId) {
      return (
        <Page>
          <PageBody>
            <div className="flex h-[50vh] flex-col items-center justify-center gap-2 text-muted-foreground">
              <p>{error || t('customers.people.detail.error.notFound')}</p>
              <Button asChild variant="outline">
                <Link href="/backend/customers/people">
                  {t('customers.people.detail.actions.backToList')}
                </Link>
              </Button>
            </div>
          </PageBody>
        </Page>
      )
    }
  
    const { person, profile } = data
  
    const detailFields: DetailFieldConfig[] = [
      {
        key: 'displayName',
        kind: 'text',
        label: t('customers.people.detail.fields.displayName'),
        value: person.displayName,
        placeholder: t('customers.people.form.displayName.placeholder'),
        emptyLabel: t('customers.people.detail.noValue'),
        validator: validators.displayName,
        onSave: updateDisplayName,
      },
      {
        key: 'firstName',
        kind: 'text',
        label: t('customers.people.form.firstName'),
        value: profile?.firstName ?? null,
        placeholder: t('customers.people.form.firstName'),
        emptyLabel: t('customers.people.detail.noValue'),
        onSave: (next) => updateProfileField('firstName', next),
      },
      {
        key: 'ownerUserId',
        kind: 'custom',
        label: t('customers.form.owner', 'Guardian'),
        emptyLabel: t('customers.people.detail.noValue'),
        render: () => (
          <InlineSelectEditor
            label={t('customers.form.owner', 'Guardian')}
            value={ownerUserId}
            emptyLabel={t('customers.people.detail.noValue')}
            options={ownerOptions.map(({ value, label, description }) => ({
              value,
              label,
              description: description ?? undefined,
            }))}
            onSave={updateOwnerUser}
            variant="muted"
            activateOnClick
            renderEditor={({ value: draft, onChange }) => (
              <EntitySearchCombobox
                value={draft}
                onChange={onChange}
                options={mergeEntitySearchOption(
                  ownerOptions,
                  draft,
                  draft === ownerUserId ? ownerLabel ?? draft : draft,
                )}
                onRemoteSearch={async (query) => {
                  const rows = await remoteSearchAuthUsers(query)
                  return mergeEntitySearchOption(
                    rows,
                    draft,
                    draft === ownerUserId ? ownerLabel ?? draft : draft,
                  )
                }}
                placeholder={t('customers.form.ownerPlaceholder', 'Choose a guardian…')}
                searchPlaceholder={t('customers.form.ownerSearch', 'Search users…')}
                createInNewTabHref="/backend/users/create"
                createInNewTabAriaLabel={t('customers.form.ownerAddUser', 'Create user in a new tab')}
              />
            )}
          />
        ),
      },
      {
        key: 'lastName',
        kind: 'text',
        label: t('customers.people.form.lastName'),
        value: profile?.lastName ?? null,
        placeholder: t('customers.people.form.lastName'),
        emptyLabel: t('customers.people.detail.noValue'),
        onSave: (next) => updateProfileField('lastName', next),
      },
      {
        key: 'pesel',
        kind: 'text',
        label: t('customers.people.form.pesel'),
        value: profile?.pesel ?? null,
        placeholder: t('customers.people.form.peselPlaceholder'),
        emptyLabel: t('customers.people.detail.noValue'),
        validator: validators.pesel,
        onSave: async (next) => {
          const digits = normalizePeselDigits(typeof next === 'string' ? next : '')
          await savePerson(
            { pesel: digits && digits.length ? digits : null },
            (prev) => {
              if (!prev.profile) return prev
              return {
                ...prev,
                profile: {
                  ...prev.profile,
                  pesel: digits && digits.length ? digits : null,
                },
              }
            },
          )
        },
      },
      {
        key: 'residenceStreet',
        kind: 'text',
        label: t('customers.people.form.residenceStreet'),
        value: profile?.residenceStreet ?? null,
        placeholder: t('customers.people.form.residenceStreetPlaceholder'),
        emptyLabel: t('customers.people.detail.noValue'),
        gridClassName: 'sm:col-span-2 xl:col-span-3',
        onSave: (next) => updateProfileField('residenceStreet', next),
      },
      {
        key: 'residencePostalCode',
        kind: 'text',
        label: t('customers.people.form.residencePostalCode'),
        value: profile?.residencePostalCode ?? null,
        placeholder: t('customers.people.form.residencePostalCodePlaceholder'),
        emptyLabel: t('customers.people.detail.noValue'),
        onSave: (next) => updateProfileField('residencePostalCode', next),
      },
      {
        key: 'residenceCity',
        kind: 'text',
        label: t('customers.people.form.residenceCity'),
        value: profile?.residenceCity ?? null,
        placeholder: t('customers.people.form.residenceCityPlaceholder'),
        emptyLabel: t('customers.people.detail.noValue'),
        onSave: (next) => updateProfileField('residenceCity', next),
      },
      {
        key: 'residenceCountry',
        kind: 'text',
        label: t('customers.people.form.residenceCountry'),
        value: profile?.residenceCountry ?? null,
        placeholder: t('customers.people.form.residenceCountryPlaceholder'),
        emptyLabel: t('customers.people.detail.noValue'),
        validator: validators.residenceCountry,
        onSave: async (next) => {
          const send = typeof next === 'string' ? next.trim().toUpperCase() : ''
          await savePerson(
            { residenceCountry: send.length ? send : null },
            (prev) => {
              if (!prev.profile) return prev
              return {
                ...prev,
                profile: {
                  ...prev.profile,
                  residenceCountry: send.length ? send : null,
                },
              }
            },
          )
        },
      },
      {
        key: 'jobTitle',
        kind: 'custom',
        label: t('customers.people.form.jobTitle'),
        emptyLabel: t('customers.people.detail.noValue'),
        render: () => (
          <InlineDictionaryEditor
            label={t('customers.people.form.jobTitle')}
            value={profile?.jobTitle ?? null}
            emptyLabel={t('customers.people.detail.noValue')}
            kind="job-titles"
            onSave={async (next) => updateProfileField('jobTitle', next)}
            selectClassName="h-9 w-full rounded border px-3 text-sm"
            variant="muted"
            activateOnClick
          />
        ),
      },
      {
        key: 'lifecycleStage',
        kind: 'custom',
        label: t('customers.people.detail.fields.lifecycleStage'),
        emptyLabel: t('customers.people.detail.noValue'),
        render: () => (
          <InlineDictionaryEditor
            label={t('customers.people.detail.fields.lifecycleStage')}
            value={person.lifecycleStage ?? null}
            emptyLabel={t('customers.people.detail.noValue')}
            kind="lifecycle-stages"
            onSave={async (next) => {
              const send = typeof next === 'string' ? next : ''
              await savePerson(
                { lifecycleStage: send },
                (prev) => ({
                  ...prev,
                  person: { ...prev.person, lifecycleStage: next && next.length ? next : null },
                })
              )
            }}
            selectClassName="h-9 w-full rounded border px-3 text-sm"
            variant="muted"
            activateOnClick
          />
        ),
      },
      {
        key: 'source',
        kind: 'custom',
        label: t('customers.people.form.source'),
        emptyLabel: t('customers.people.detail.noValue'),
        render: () => (
          <InlineDictionaryEditor
            label={t('customers.people.form.source')}
            value={person.source ?? null}
            emptyLabel={t('customers.people.detail.noValue')}
            kind="sources"
            onSave={async (next) => {
              const send = typeof next === 'string' ? next : ''
              await savePerson(
                { source: send },
                (prev) => ({
                  ...prev,
                  person: { ...prev.person, source: next && next.length ? next : null },
                })
              )
            }}
            selectClassName="h-9 w-full rounded border px-3 text-sm"
            variant="muted"
            activateOnClick
          />
        ),
      },
      {
        key: 'description',
        kind: 'multiline',
        label: t('customers.people.form.description'),
        value: person.description ?? null,
        placeholder: t('customers.people.form.description'),
        emptyLabel: t('customers.people.detail.noValue'),
        gridClassName: 'sm:col-span-2 xl:col-span-3',
        renderDisplay: renderMultilineMarkdownDisplay,
        onSave: async (next) => {
          const send = typeof next === 'string' ? next : ''
          await savePerson(
            { description: send },
            (prev) => ({
              ...prev,
              person: { ...prev.person, description: next && next.length ? next : null },
            })
          )
        },
      },
      {
        key: 'department',
        kind: 'text',
        label: t('customers.people.detail.fields.department'),
        value: profile?.department ?? null,
        placeholder: t('customers.people.detail.fields.department'),
        emptyLabel: t('customers.people.detail.noValue'),
        onSave: (next) => updateProfileField('department', next),
      },
      {
        key: 'linkedInUrl',
        kind: 'text',
        label: t('customers.people.detail.fields.linkedIn'),
        value: profile?.linkedInUrl ?? null,
        placeholder: t('customers.people.detail.fields.linkedIn'),
        emptyLabel: t('customers.people.detail.noValue'),
        onSave: (next) => updateProfileField('linkedInUrl', next),
        inputType: 'url',
        validator: validators.linkedInUrl,
        renderDisplay: renderLinkedInDisplay,
      },
      {
        key: 'twitterUrl',
        kind: 'text',
        label: t('customers.people.detail.fields.twitter'),
        value: profile?.twitterUrl ?? null,
        placeholder: t('customers.people.detail.fields.twitter'),
        emptyLabel: t('customers.people.detail.noValue'),
        onSave: (next) => updateProfileField('twitterUrl', next),
        inputType: 'url',
        validator: validators.twitterUrl,
        renderDisplay: renderTwitterDisplay,
      },
    ]
  
    return (
      <Page>
        <PageBody className="space-y-4">
          <PersonHighlights
            person={person}
            profile={profile}
            validators={{
              email: validators.email,
              phone: validators.phone,
              displayName: validators.displayName,
            }}
            utilityActions={(
              <SendObjectMessageDialog
                object={{
                  entityModule: 'customers',
                  entityType: 'person',
                  entityId: personId,
                  previewData: {
                    title: person.displayName,
                    subtitle: person.primaryEmail ?? undefined,
                    metadata: {
                      [t('customers.people.detail.highlights.primaryPhone')]: person.primaryPhone ?? '-',
                      [t('customers.people.detail.fields.jobTitle')]: profile?.jobTitle ?? '-',
                    },
                  },
                }}
                viewHref={`/backend/customers/people/${personId}`}
              />
            )}
            onDisplayNameSave={updateDisplayName}
            onPrimaryEmailSave={async (next) => {
              const send = typeof next === 'string' ? next : ''
              await savePerson(
                { primaryEmail: send },
                (prev) => ({
                  ...prev,
                  person: {
                    ...prev.person,
                    primaryEmail: next && next.length ? next.toLowerCase() : null,
                  },
                })
              )
            }}
            onPrimaryPhoneSave={async (next) => {
              const send = typeof next === 'string' ? next : ''
              await savePerson(
                { primaryPhone: send },
                (prev) => ({
                  ...prev,
                  person: {
                    ...prev.person,
                    primaryPhone: next && next.length ? next : null,
                  },
                })
              )
            }}
            onStatusSave={async (next) => {
              const send = typeof next === 'string' ? next : ''
              await savePerson(
                { status: send },
                (prev) => ({
                  ...prev,
                  person: {
                    ...prev.person,
                    status: next && next.length ? next : null,
                  },
                })
              )
            }}
            onNextInteractionSave={async (next) => {
              await savePerson(
                {
                  nextInteraction: next
                    ? {
                        at: next.at,
                        name: next.name,
                        refId: next.refId ?? undefined,
                        icon: next.icon ?? undefined,
                        color: next.color ?? undefined,
                      }
                    : null,
                },
                (prev) => ({
                  ...prev,
                  person: {
                    ...prev.person,
                    nextInteractionAt: next ? next.at : null,
                    nextInteractionName: next ? next.name || null : null,
                    nextInteractionRefId: next ? next.refId || null : null,
                    nextInteractionIcon: next ? next.icon || null : null,
                    nextInteractionColor: next ? next.color || null : null,
                  },
                })
              )
            }}
            onDelete={handleDelete}
            isDeleting={isDeleting}
            onCompanySave={async (next) => {
              const normalized = typeof next === 'string' && next.trim().length ? next.trim() : null
              await savePerson(
                { companyEntityId: normalized },
                (prev) => {
                  if (!prev.profile) return prev
                  return {
                    ...prev,
                    profile: {
                      ...prev.profile,
                      companyEntityId: normalized,
                    },
                  }
                }
              )
            }}
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[7fr_3fr] lg:items-start">
            <div className="min-w-0">
              <DetailTabsLayout
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                navAriaLabel={t('customers.people.detail.tabs.label', 'Person detail sections')}
                headerClassName="mb-1"
                panelContentKey={activeTab}
              >
                {(() => {
                  const injected = injectedTabMap.get(activeTab)
                  if (injected) return injected()
                  if (activeTab === 'details') {
                    return (
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <h2 className="text-sm font-semibold">{t('customers.people.detail.sections.details')}</h2>
                          <DetailFieldsSection
                            fields={detailFields.filter((field) => field.key !== 'description')}
                          />
                          <InjectionSpot
                            spotId="customers.person.detail:details"
                            context={injectionContext}
                            data={data}
                            onDataChange={(next) => setData(next as PersonOverview)}
                          />
                        </div>
                      </div>
                    )
                  }
                  if (activeTab === 'notes') {
                return (
                  <NotesSection
                    entityId={personId}
                    dealOptions={dealSelectOptions}
                    emptyLabel={t('customers.people.detail.empty.comments')}
                    viewerUserId={data.viewer?.userId ?? null}
                    viewerName={data.viewer?.name ?? null}
                    viewerEmail={data.viewer?.email ?? null}
                    addActionLabel={t('customers.people.detail.notes.addLabel')}
                    emptyState={{
                      title: t('customers.people.detail.emptyState.notes.title'),
                      actionLabel: t('customers.people.detail.emptyState.notes.action'),
                    }}
                    translator={detailTranslator}
                    onLoadingChange={handleNotesLoadingChange}
                    dataAdapter={notesAdapter}
                    renderIcon={renderDictionaryIcon}
                    renderColor={renderDictionaryColor}
                    iconSuggestions={ICON_SUGGESTIONS}
                    readMarkdownPreference={readMarkdownPreferenceCookie}
                    writeMarkdownPreference={writeMarkdownPreferenceCookie}
                  />
                )
              }
              if (activeTab === 'activities') {
                return (
                  <ActivitiesSection
                    entityId={personId}
                    dealOptions={dealSelectOptions}
                    defaultEntityId={personId ?? undefined}
                    runGuardedMutation={runMutationWithContext}
                    addActionLabel={t('customers.people.detail.activities.add')}
                    emptyState={{
                      title: t('customers.people.detail.emptyState.activities.title'),
                      actionLabel: t('customers.people.detail.emptyState.activities.action'),
                    }}
                    onLoadingChange={handleActivitiesLoadingChange}
                  />
                )
              }
              if (activeTab === 'deals') {
                return (
                  <DealsSection
                    scope={dealsScope}
                    emptyLabel={t('customers.people.detail.empty.deals')}
                    addActionLabel={t('customers.people.detail.actions.addDeal')}
                    emptyState={{
                      title: t('customers.people.detail.emptyState.deals.title'),
                      actionLabel: t('customers.people.detail.emptyState.deals.action'),
                    }}
                    onLoadingChange={handleDealsLoadingChange}
                    translator={detailTranslator}
                    createHref={dealCreateHref}
                  />
                )
              }
              if (activeTab === 'quotes') {
                return (
                  <CustomerEntityQuotesTab
                    customerEntityId={personId}
                    ownerUserId={data.person.ownerUserId ?? null}
                    kind="person"
                    addActionLabel={t('customers.people.detail.actions.addQuote', 'Add quote')}
                    emptyState={{
                      title: t('customers.people.detail.emptyState.quotes.title', 'No quotes yet'),
                      actionLabel: t('customers.people.detail.emptyState.quotes.action', 'Create a quote'),
                    }}
                  />
                )
              }
              if (activeTab === 'orders') {
                return (
                  <CustomerEntityOrdersTab
                    customerEntityId={personId}
                    ownerUserId={data.person.ownerUserId ?? null}
                    kind="person"
                    addActionLabel={t('customers.people.detail.actions.addOrder', 'Add order')}
                    emptyState={{
                      title: t('customers.people.detail.emptyState.orders.title', 'No orders yet'),
                      actionLabel: t('customers.people.detail.emptyState.orders.action', 'Create an order'),
                    }}
                  />
                )
              }
              if (activeTab === 'addresses') {
                return (
                  <AddressesSection
                    entityId={personId}
                    emptyLabel={t('customers.people.detail.empty.addresses')}
                    addActionLabel={t('customers.people.detail.addresses.add')}
                    emptyState={{
                      title: t('customers.people.detail.emptyState.addresses.title'),
                      actionLabel: t('customers.people.detail.emptyState.addresses.action'),
                    }}
                    onLoadingChange={handleAddressesLoadingChange}
                    translator={detailTranslator}
                  />
                )
              }
              if (activeTab === 'tasks') {
                return (
                  <TasksSection
                    entityId={personId}
                    initialTasks={data.todos}
                    runGuardedMutation={runMutationWithContext}
                    emptyLabel={t('customers.people.detail.empty.todos')}
                    addActionLabel={t('customers.people.detail.tasks.add')}
                    emptyState={{
                      title: t('customers.people.detail.emptyState.tasks.title'),
                      actionLabel: t('customers.people.detail.emptyState.tasks.action'),
                    }}
                    onLoadingChange={handleTasksLoadingChange}
                    translator={detailTranslator}
                    entityName={personName}
                    dialogContextKey="customers.people.detail.tasks.dialog.context"
                    dialogContextFallback="This task will be linked to {{name}}"
                  />
                )
              }
              if (activeTab === 'resources') {
                return <PersonResourcesSection customerEntityId={personId} />
              }
              if (activeTab === 'cases') {
                return (
                  <CustomerEntityCasesTab
                    customerEntityId={personId}
                    ownerUserId={data.person.ownerUserId ?? null}
                    kind="person"
                    addActionLabel={t('customers.people.detail.actions.addCase', 'Add case')}
                    emptyState={{
                      title: t('customers.people.detail.emptyState.cases.title', 'No cases yet'),
                      actionLabel: t('customers.people.detail.emptyState.cases.action', 'Create a case'),
                    }}
                  />
                )
              }
              if (activeTab === 'policies') {
                return (
                  <CustomerEntityPoliciesTab
                    customerEntityId={personId}
                    ownerUserId={data.person.ownerUserId ?? null}
                    kind="person"
                    addActionLabel={t('customers.people.detail.actions.addPolicy', 'Add policy')}
                    emptyState={{
                      title: t('customers.people.detail.emptyState.policies.title', 'No policies yet'),
                      actionLabel: t('customers.people.detail.emptyState.policies.action', 'Create a policy'),
                    }}
                  />
                )
              }
              return null
            })()}
              </DetailTabsLayout>
            </div>

            <aside className="min-w-0 space-y-4">
              <div className="rounded-lg border bg-card px-4 py-3">
                <CustomDataSection
                  entityIds={[E.customers.customer_entity, E.customers.customer_person_profile]}
                  values={data.customFields ?? {}}
                  onSubmit={handleCustomFieldsSubmit}
                  title={t('customers.people.detail.sections.customFields')}
                />
              </div>
              <div className="rounded-lg border bg-card px-4 py-3 space-y-3">
                <h2 className="text-sm font-semibold">{t('customers.people.form.groups.notes', 'Notes')}</h2>
                <DetailFieldsSection
                  fields={detailFields.filter((field) => field.key === 'description')}
                  className="sm:grid-cols-1 xl:grid-cols-1"
                />
              </div>
              <div className="rounded-lg border bg-card px-4 py-3">
                <TagsSection
                  entityId={data.person.id}
                  tags={data.tags}
                  onChange={handleTagsChange}
                  isSubmitting={false}
                />
              </div>
            </aside>
          </div>

        </PageBody>
        {ConfirmDialogElement}
      </Page>
    )
  }
  
