"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { FormHeader } from '@open-mercato/ui/backend/forms'
import { VersionHistoryAction } from '@open-mercato/ui/backend/version-history'
import { updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { createCrudFormError } from '@open-mercato/ui/backend/utils/serverErrors'
import { E } from '#generated/entities.ids.generated'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { Button } from '@open-mercato/ui/primitives/button'
import { ErrorMessage, LoadingMessage, NotesSection } from '@open-mercato/ui/backend/detail'
import { InjectionSpot, useInjectionWidgets } from '@open-mercato/ui/backend/injection/InjectionSpot'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { createTranslatorWithFallback } from '@open-mercato/shared/lib/i18n/translate'
import { renderDictionaryColor, renderDictionaryIcon } from '@open-mercato/core/modules/dictionaries/components/dictionaryAppearance'
import { ICON_SUGGESTIONS } from '../../../../lib/dictionaries'
import { createCustomerNotesAdapter } from '../../../../components/detail/notesAdapter'
import { readMarkdownPreferenceCookie, writeMarkdownPreferenceCookie } from '../../../../lib/markdownPreference'
import { ActivitiesSection } from '../../../../components/detail/ActivitiesSection'
import { DealsSection } from '../../../../components/detail/DealsSection'
import { AddressesSection } from '../../../../components/detail/AddressesSection'
import { TasksSection } from '../../../../components/detail/TasksSection'
import { TagsSection } from '../../../../components/detail/TagsSection'
import type { TagSummary } from '../../../../components/detail/types'
import { DetailTabsLayout } from '../../../../components/detail/DetailTabsLayout'
import { PersonResourcesSection } from '../../../../components/detail/PersonResourcesSection'
import { PersonHighlightsSummary } from '../../../../components/detail/CustomerFormHighlights'
import { CustomerDetailSaveGuideHint } from '../../../../components/detail/CustomerDetailSaveGuideHint'
import {
  buildCustomerDetailTabDefinitions,
  resolveCustomerDetailTab,
} from '../../../../components/detail/customerEntityDetailTabs'
import { buildSimpleDealCreateHref } from '../../../../components/detail/customerEntityCreatePrefill'
import { CustomerEntityOrdersTab } from '../../../../components/detail/CustomerEntityOrdersTab'
import { CustomerEntityQuotesTab } from '../../../../components/detail/CustomerEntityQuotesTab'
import { CustomerEntityCasesTab } from '../../../../components/detail/CustomerEntityCasesTab'
import { CustomerEntityPoliciesTab } from '../../../../components/detail/CustomerEntityPoliciesTab'
import type { TagsSectionController } from '@open-mercato/ui/backend/detail'
import {
  buildPersonEditPayload,
  createPersonEditFields,
  createPersonEditGroups,
  createPersonEditSchema,
  mapPersonOverviewToFormValues,
  type PersonEditFormValues,
  type PersonOverview,
} from '../../../../components/formConfig'

type SectionKey = string

export default function PersonDetailV2Page({ params }: { params?: { id?: string } }) {
  const id = params?.id
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { organizationId } = useOrganizationScopeDetail()

  const detailTranslator = React.useMemo(() => createTranslatorWithFallback(t), [t])
  const notesAdapter = React.useMemo(() => createCustomerNotesAdapter(detailTranslator), [detailTranslator])

  const formSchema = React.useMemo(() => createPersonEditSchema(), [])
  const fields = React.useMemo(() => createPersonEditFields(t), [t])
  const tagsSectionControllerRef = React.useRef<TagsSectionController | null>(null)

  const [data, setData] = React.useState<PersonOverview | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const initialTab = React.useMemo(
    () => resolveCustomerDetailTab(searchParams?.get('tab')),
    [searchParams],
  )
  const [activeTab, setActiveTab] = React.useState<SectionKey>(initialTab)

  React.useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  const currentPersonId = data?.person?.id ?? null

  const handleTagsChange = React.useCallback((nextTags: TagSummary[]) => {
    setData((prev) => (prev ? { ...prev, tags: nextTags } : prev))
  }, [])

  const groups = React.useMemo(() => {
    const base = createPersonEditGroups(t)
    const main = base.filter((group) => group.id !== 'notes' && group.id !== 'customFields')
    const customFields = base.find((group) => group.id === 'customFields')
    const notes = base.find((group) => group.id === 'notes')
    return [
      ...main,
      ...(customFields ? [customFields] : []),
      ...(notes ? [notes] : []),
      {
        id: 'tags',
        title: t('customers.people.detail.sections.tags', 'Tags'),
        column: 2 as const,
        component: () =>
          currentPersonId ? (
            <TagsSection
              entityId={currentPersonId}
              tags={data?.tags ?? []}
              onChange={handleTagsChange}
              isSubmitting={false}
              controllerRef={tagsSectionControllerRef}
            />
          ) : null,
      },
    ]
  }, [currentPersonId, data?.tags, handleTagsChange, t])
  const mutationContextId = React.useMemo(
    () => (currentPersonId ? `customer-person:${currentPersonId}` : `customer-person:${id ?? 'pending'}`),
    [currentPersonId, id],
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
  const personName =
    data?.person?.displayName && data.person.displayName.trim().length
      ? data.person.displayName
      : t('customers.people.list.deleteFallbackName', 'this person')

  const initialLoadDoneRef = React.useRef(false)
  const loadData = React.useCallback(async () => {
    if (!id) {
      setError(t('customers.people.detail.error.notFound', 'Person not found.'))
      setIsLoading(false)
      return
    }
    if (!initialLoadDoneRef.current) {
      setIsLoading(true)
    }
    setError(null)
    try {
      const search = new URLSearchParams()
      search.append('include', 'todos')
      search.append('include', 'interactions')
      const payload = await readApiResultOrThrow<PersonOverview>(
        `/api/customers/people/${encodeURIComponent(id)}?${search.toString()}`,
        undefined,
        { errorMessage: t('customers.people.detail.error.load', 'Failed to load person.') },
      )
      setData(payload as PersonOverview)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('customers.people.detail.error.load', 'Failed to load person.')
      setError(message)
      if (!initialLoadDoneRef.current) setData(null)
    } finally {
      setIsLoading(false)
      initialLoadDoneRef.current = true
    }
  }, [id, t])

  React.useEffect(() => {
    loadData().catch(() => {})
  }, [loadData])

  // Zone 2: Injection widgets for custom tabs
  const injectionContext = React.useMemo(
    () => ({
      formId: mutationContextId,
      personId: currentPersonId,
      resourceKind: 'customers.person',
      resourceId: currentPersonId ?? (id ?? undefined),
      data,
      retryLastMutation,
    }),
    [currentPersonId, data, id, mutationContextId, retryLastMutation],
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

  const { widgets: injectedTabWidgets } = useInjectionWidgets('detail:customers.person:tabs', {
    context: injectionContext,
    triggerOnLoad: true,
  })

  const injectedTabs = React.useMemo(
    () =>
      (injectedTabWidgets ?? [])
        .filter((widget) => (widget.placement?.kind ?? 'tab') === 'tab')
        .map((widget) => {
          const tabId = widget.placement?.groupId ?? widget.widgetId
          const label = widget.placement?.groupLabel ?? widget.module.metadata.title
          const priority = typeof widget.placement?.priority === 'number' ? widget.placement.priority : 0
          const render = () => (
            <widget.module.Widget
              context={injectionContext}
              data={data}
              onDataChange={(next: unknown) => setData(next as PersonOverview)}
            />
          )
          return { id: tabId, label, priority, render }
        })
        .sort((a, b) => b.priority - a.priority),
    [data, injectedTabWidgets, injectionContext],
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

  const dealsScope = React.useMemo(
    () => (currentPersonId ? ({ kind: 'person', entityId: currentPersonId } as const) : null),
    [currentPersonId],
  )

  const ownerUserId = data?.person?.ownerUserId ?? null

  const dealCreateHref = React.useMemo(
    () =>
      currentPersonId
        ? buildSimpleDealCreateHref({ customerEntityId: currentPersonId, ownerUserId, kind: 'person' })
        : null,
    [currentPersonId, ownerUserId],
  )

  const initialValues = React.useMemo(
    () => (data ? mapPersonOverviewToFormValues(data) : undefined),
    [data],
  )

  const contentHeader = React.useMemo(
    () => (data ? <PersonHighlightsSummary data={data} /> : undefined),
    [data],
  )

  const handleFormSubmit = React.useCallback(
    async (values: PersonEditFormValues) => {
      await tagsSectionControllerRef.current?.flush()

      let payload: Record<string, unknown>
      try {
        payload = buildPersonEditPayload(values, organizationId)
      } catch (err) {
        if (err instanceof Error && err.message === 'DISPLAY_NAME_REQUIRED') {
          const message = t('customers.people.form.displayName.error')
          throw createCrudFormError(message, { displayName: message })
        }
        throw err
      }

      await updateCrud('customers/people', payload)
      flash(t('customers.people.form.updateSuccess', 'Person updated.'), 'success')
      await loadData()
    },
    [loadData, organizationId, t],
  )

  const handleFormDelete = React.useCallback(
    async () => {
      await deleteCrud('customers/people', { id: data?.person?.id ?? '' })
      flash(t('customers.people.list.deleteSuccess', 'Person deleted.'), 'success')
      router.push('/backend/customers/people')
    },
    [data?.person?.id, router, t],
  )

  if (isLoading) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('customers.people.detail.loading', 'Loading person…')} />
        </PageBody>
      </Page>
    )
  }

  if (error || !data?.person?.id || !initialValues) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage
            label={error || t('customers.people.detail.error.notFound', 'Person not found.')}
            action={(
              <Button asChild variant="outline">
                <Link href="/backend/customers/people">
                  {t('customers.people.detail.actions.backToList', 'Back to people')}
                </Link>
              </Button>
            )}
          />
        </PageBody>
      </Page>
    )
  }

  const personId = data.person.id
  const useCanonicalInteractions = data.interactionMode === 'canonical'
  const personFormId = `customers-person-detail-${personId}`

  return (
    <Page>
      <PageBody>
        <div className="space-y-4">
          <InjectionSpot spotId="detail:customers.person:header" context={injectionContext} data={data} />
          <InjectionSpot spotId="detail:customers.person:status-badges" context={injectionContext} data={data} />

          <FormHeader
            mode="edit"
            title={data.person.displayName}
            backHref="/backend/customers/people"
            backLabel={t('customers.people.detail.actions.backToList', 'Back to people')}
            actions={{
              extraActions: (
                <>
                  <CustomerDetailSaveGuideHint />
                  <VersionHistoryAction
                    t={t}
                    config={{
                      resourceKind: 'customers.person',
                      resourceId: personId,
                    }}
                  />
                </>
              ),
              showDelete: true,
              onDelete: () => {
                void handleFormDelete()
              },
              submit: {
                formId: personFormId,
                label: t('ui.forms.actions.save', 'Save'),
              },
            }}
          />

          <div className="min-w-0">
              <DetailTabsLayout
                className="space-y-6"
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                navAriaLabel={t('customers.people.detail.tabs.label', 'Person detail sections')}
                navClassName="gap-4"
                panelContentKey="person-detail-main"
              >
                <div className={activeTab === 'details' ? 'space-y-6' : 'hidden'}>
                  <CrudForm<PersonEditFormValues>
                    formId={personFormId}
                    embedded
                    hideFooterActions
                    title={data.person.displayName}
                    injectionSpotId="customers.person"
                    entityIds={[E.customers.customer_entity, E.customers.customer_person_profile]}
                    schema={formSchema}
                    fields={fields}
                    groups={groups}
                    initialValues={initialValues}
                    contentHeader={contentHeader}
                    onSubmit={handleFormSubmit}
                  />
                </div>
                {activeTab !== 'details' ? (() => {
                  const injected = injectedTabMap.get(activeTab)
                  if (injected) return injected()
                  if (activeTab === 'notes') {
                    return (
                      <NotesSection
                        entityId={personId}
                        emptyLabel={t('customers.people.detail.empty.comments', 'No notes yet.')}
                        viewerUserId={data.viewer?.userId ?? null}
                        viewerName={data.viewer?.name ?? null}
                        viewerEmail={data.viewer?.email ?? null}
                        addActionLabel={t('customers.people.detail.notes.addLabel', 'Add note')}
                        emptyState={{
                          title: t('customers.people.detail.emptyState.notes.title', 'Keep everyone in the loop'),
                          actionLabel: t('customers.people.detail.emptyState.notes.action', 'Create a note'),
                        }}
                        translator={detailTranslator}
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
                        useCanonicalInteractions={useCanonicalInteractions}
                        runGuardedMutation={runMutationWithContext}
                        onDataRefresh={loadData}
                        addActionLabel={t('customers.people.detail.activities.add', 'Log activity')}
                        emptyState={{
                          title: t('customers.people.detail.emptyState.activities.title', 'No activities logged yet'),
                          actionLabel: t('customers.people.detail.emptyState.activities.action', 'Log activity'),
                        }}
                      />
                    )
                  }
                  if (activeTab === 'deals') {
                    return (
                      <DealsSection
                        scope={dealsScope}
                        emptyLabel={t('customers.people.detail.empty.deals', 'No deals linked to this person.')}
                        addActionLabel={t('customers.people.detail.actions.addDeal', 'Add deal')}
                        emptyState={{
                          title: t('customers.people.detail.emptyState.deals.title', 'No deals yet'),
                          actionLabel: t('customers.people.detail.emptyState.deals.action', 'Create a deal'),
                        }}
                        translator={detailTranslator}
                        createHref={dealCreateHref}
                      />
                    )
                  }
                  if (activeTab === 'quotes') {
                    return (
                      <CustomerEntityQuotesTab
                        customerEntityId={personId}
                        ownerUserId={ownerUserId}
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
                        ownerUserId={ownerUserId}
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
                        emptyLabel={t('customers.people.detail.empty.addresses', 'No addresses recorded.')}
                        addActionLabel={t('customers.people.detail.addresses.add', 'Add address')}
                        emptyState={{
                          title: t('customers.people.detail.emptyState.addresses.title', 'No addresses yet'),
                          actionLabel: t('customers.people.detail.emptyState.addresses.action', 'Add address'),
                        }}
                        translator={detailTranslator}
                      />
                    )
                  }
                  if (activeTab === 'tasks') {
                    return (
                      <TasksSection
                        entityId={personId}
                        initialTasks={data.todos}
                        useCanonicalInteractions={useCanonicalInteractions}
                        runGuardedMutation={runMutationWithContext}
                        onDataRefresh={loadData}
                        emptyLabel={t('customers.people.detail.empty.todos', 'No tasks linked to this person.')}
                        addActionLabel={t('customers.people.detail.tasks.add', 'Add task')}
                        emptyState={{
                          title: t('customers.people.detail.emptyState.tasks.title', 'Plan what happens next'),
                          actionLabel: t('customers.people.detail.emptyState.tasks.action', 'Create task'),
                        }}
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
                        ownerUserId={ownerUserId}
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
                        ownerUserId={ownerUserId}
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
                })() : null}
              </DetailTabsLayout>
            </div>

          <InjectionSpot spotId="detail:customers.person:footer" context={injectionContext} data={data} />
        </div>
      </PageBody>
    </Page>
  )
}
