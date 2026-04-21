"use client"

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { z } from 'zod'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { EntitySearchCombobox } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import { DictionaryEntrySelect } from '@open-mercato/core/modules/dictionaries/components/DictionaryEntrySelect'
import { clearProcurementDictionaryIdCache, fetchDictionaryOptionsByKey } from '../../../../lib/fetchDictionaryOptionsByKey'
import { procurementDictionarySelectLabels } from '../../../../lib/procurementDictionarySelectLabels'
import {
  mergeEntitySearchOption,
  remoteSearchAuthUsers,
  remoteSearchCustomerEntities,
  remoteSearchSalesQuotes,
} from '../../../../lib/procurementEntitySearch'
import {
  PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY,
  PROCUREMENT_PROCESS_TYPE_DICTIONARY_KEY,
} from '../../../../lib/dictionaryKeys'

type ProcurementProcessCreateValues = {
  title: string
  description: string
  customerEntityId: string
  salesQuoteId: string
  statusValue?: string
  typeValue?: string
  handlerUserId?: string
}

const LIST_HREF = '/backend/procurement/processes'

export default function ProcurementProcessCreatePage() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo')
  const scopeVersion = useOrganizationScopeVersion()
  const { runMutation } = useGuardedMutation<{ scopeVersion: number }>({
    contextId: 'procurement-process-create',
  })

  React.useEffect(() => {
    clearProcurementDictionaryIdCache()
  }, [scopeVersion])

  const [orgDefaultStartStatusConfigured, setOrgDefaultStartStatusConfigured] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await apiCall<{ hasOrgDefaultStartStatus?: boolean }>(
        '/api/procurement/organization-settings/default-for-create',
      )
      if (cancelled) return
      if (!res.ok) {
        setOrgDefaultStartStatusConfigured(false)
        return
      }
      setOrgDefaultStartStatusConfigured(res.result?.hasOrgDefaultStartStatus === true)
    })()
    return () => {
      cancelled = true
    }
  }, [scopeVersion])

  const hideStatusPicker = orgDefaultStartStatusConfigured === true

  const statusDictLabels = React.useMemo(() => procurementDictionarySelectLabels(t, 'status'), [t])
  const typeDictLabels = React.useMemo(() => procurementDictionarySelectLabels(t, 'type'), [t])

  const fetchStatusOptions = React.useCallback(
    () => fetchDictionaryOptionsByKey(PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY),
    [],
  )
  const fetchTypeOptions = React.useCallback(
    () => fetchDictionaryOptionsByKey(PROCUREMENT_PROCESS_TYPE_DICTIONARY_KEY),
    [],
  )

  const formSchema = React.useMemo(
    () =>
      z.object({
        title: z
          .string()
          .refine((s) => s.trim().length > 0, {
            message: t('procurement.processes.form.titleRequired', 'Title is required.'),
          }),
        description: z.string(),
        customerEntityId: z.string(),
        salesQuoteId: z.string(),
        statusValue: z.string().optional(),
        typeValue: z.string().optional(),
        handlerUserId: z.string().optional(),
      }),
    [t],
  )

  const fields = React.useMemo<CrudField[]>(() => {
    const titleField: CrudField = {
      id: 'title',
      label: t('procurement.processes.create.fields.title', 'Title'),
      type: 'text',
      required: true,
      ...(hideStatusPicker ? { layout: 'half' as const } : { layout: 'full' as const }),
    }

    const typeField: CrudField = {
      id: 'typeValue',
      label: t('procurement.processes.detail.type', 'Type'),
      type: 'custom',
      layout: hideStatusPicker ? 'quarter' : 'third',
      component: ({ value, setValue, disabled }) => (
        <DictionaryEntrySelect
          value={typeof value === 'string' && value.trim() ? value : undefined}
          onChange={(next) => setValue(next ?? '')}
          fetchOptions={fetchTypeOptions}
          labels={typeDictLabels}
          manageHref={`/backend/config/dictionaries?key=${encodeURIComponent(PROCUREMENT_PROCESS_TYPE_DICTIONARY_KEY)}`}
          allowInlineCreate={false}
          allowAppearance
          selectClassName="w-full"
          showLabelInput={false}
          disabled={disabled}
        />
      ),
    }

    const statusField: CrudField = {
      id: 'statusValue',
      label: t('procurement.processes.detail.status', 'Status'),
      type: 'custom',
      layout: 'third',
      component: ({ value, setValue, disabled }) => (
        <DictionaryEntrySelect
          value={typeof value === 'string' && value.trim() ? value : undefined}
          onChange={(next) => setValue(next ?? '')}
          fetchOptions={fetchStatusOptions}
          labels={statusDictLabels}
          manageHref={`/backend/config/dictionaries?key=${encodeURIComponent(PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY)}`}
          allowInlineCreate={false}
          allowAppearance
          selectClassName="w-full"
          showLabelInput={false}
          disabled={disabled}
        />
      ),
    }

    const handlerField: CrudField = {
      id: 'handlerUserId',
      label: t('procurement.processes.create.fields.handlerUser', 'Assigned handler'),
      type: 'custom',
      layout: hideStatusPicker ? 'quarter' : 'third',
      component: ({ value, setValue, disabled }) => {
        const str = typeof value === 'string' ? value : ''
        return (
          <EntitySearchCombobox
            value={str}
            onChange={(next) => setValue(next)}
            options={mergeEntitySearchOption([], str, str)}
            onRemoteSearch={remoteSearchAuthUsers}
            placeholder={t('procurement.processes.create.fields.handlerSearch', 'Search users…')}
            disabled={disabled}
          />
        )
      },
    }

    return [
      titleField,
      typeField,
      ...(hideStatusPicker ? [] : [statusField]),
      handlerField,
      {
        id: 'description',
        label: t('procurement.processes.create.fields.description', 'Description'),
        type: 'richtext',
      },
      {
        id: 'customerEntityId',
        label: t('procurement.processes.create.fields.customerEntity', 'Customer'),
        type: 'custom',
        component: ({ value, setValue, disabled }) => {
          const [options, setOptions] = React.useState<
            Array<{ value: string; label: string; description?: string | null }>
          >([])
          const str = typeof value === 'string' ? value : ''
          return (
            <EntitySearchCombobox
              value={str}
              onChange={(next) => setValue(next)}
              options={options}
              onRemoteSearch={async (q) => {
                const rows = await remoteSearchCustomerEntities(q)
                setOptions(rows)
                return rows
              }}
              placeholder={t('procurement.processes.create.fields.customerSearch', 'Search customers…')}
              disabled={disabled}
              createInNewTabHref="/backend/customers/companies/create"
              createInNewTabAriaLabel={t(
                'procurement.processes.create.fields.customerAdd',
                'Open customers in a new tab',
              )}
            />
          )
        },
      },
      {
        id: 'salesQuoteId',
        label: t('procurement.processes.create.fields.salesQuote', 'Sales quote'),
        type: 'custom',
        component: ({ value, setValue, disabled }) => {
          const [options, setOptions] = React.useState<
            Array<{ value: string; label: string; description?: string | null }>
          >([])
          const str = typeof value === 'string' ? value : ''
          return (
            <EntitySearchCombobox
              value={str}
              onChange={(next) => setValue(next)}
              options={options}
              onRemoteSearch={async (q) => {
                const rows = await remoteSearchSalesQuotes(q)
                setOptions(rows)
                return rows
              }}
              placeholder={t('procurement.processes.create.fields.quoteSearch', 'Search quotes…')}
              disabled={disabled}
              createInNewTabHref="/backend/sales/documents/create"
              createInNewTabAriaLabel={t(
                'procurement.processes.create.fields.quoteAdd',
                'Create document in a new tab',
              )}
            />
          )
        },
      },
    ]
  }, [
    fetchStatusOptions,
    fetchTypeOptions,
    hideStatusPicker,
    statusDictLabels,
    typeDictLabels,
    t,
  ])

  const groups = React.useMemo<CrudFormGroup[]>(
    () => [
      {
        id: 'basics',
        title: t('procurement.processes.form.groups.basics', 'Basics'),
        column: 1,
        fields: hideStatusPicker
          ? ['title', 'typeValue', 'handlerUserId']
          : ['title', 'typeValue', 'statusValue', 'handlerUserId'],
      },
      {
        id: 'details',
        title: t('procurement.processes.form.groups.details', 'Details'),
        column: 1,
        fields: ['description'],
      },
      {
        id: 'relations',
        title: t('procurement.processes.form.groups.relations', 'Relations'),
        column: 2,
        fields: ['customerEntityId', 'salesQuoteId'],
      },
    ],
    [hideStatusPicker, t],
  )

  const listHref = returnTo ?? LIST_HREF

  return (
    <Page>
      <PageBody>
        <CrudForm<ProcurementProcessCreateValues>
          title={t('procurement.processes.create.title', 'Create procurement process')}
          backHref={listHref}
          cancelHref={listHref}
          submitLabel={t('procurement.processes.form.submit', 'Save')}
          fields={fields}
          groups={groups}
          initialValues={{
            title: '',
            description: '',
            customerEntityId: '',
            salesQuoteId: '',
            statusValue: undefined,
            typeValue: undefined,
            handlerUserId: '',
          }}
          schema={formSchema}
          onSubmit={async (values) => {
            const payload: Record<string, unknown> = {
              title: values.title.trim(),
              description: values.description.trim() || null,
            }
            const c = values.customerEntityId.trim()
            if (c) payload.customerEntityId = c
            const q = values.salesQuoteId.trim()
            if (q) payload.salesQuoteId = q
            const sv = typeof values.statusValue === 'string' ? values.statusValue.trim() : ''
            if (sv) payload.statusValue = sv
            const tv = typeof values.typeValue === 'string' ? values.typeValue.trim() : ''
            if (tv) payload.typeValue = tv
            const hu = typeof values.handlerUserId === 'string' ? values.handlerUserId.trim() : ''
            if (hu) payload.handlerUserId = hu

            const call = await runMutation({
              context: { scopeVersion },
              mutationPayload: { op: 'procurement.processes.create', ...payload },
              operation: async () =>
                createCrud<{ id?: string }>('procurement/processes', payload, {
                  errorMessage: t('procurement.processes.create.error', 'Failed to create process.'),
                }),
            })

            flash(t('procurement.processes.create.success', 'Process created.'), 'success')
            const newId = typeof call.result?.id === 'string' ? call.result.id : null
            if (returnTo) {
              router.push(returnTo)
              return
            }
            if (newId) {
              router.push(`/backend/procurement/processes/${encodeURIComponent(newId)}`)
              return
            }
            router.push(LIST_HREF)
          }}
        />
      </PageBody>
    </Page>
  )
}
