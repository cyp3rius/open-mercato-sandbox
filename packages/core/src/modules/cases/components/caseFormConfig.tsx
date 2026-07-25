'use client'

import * as React from 'react'
import { z } from 'zod'
import type { TranslateFn } from '@open-mercato/shared/lib/i18n/context'
import type { CrudField, CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { EntitySearchCombobox } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import {
  mergeEntitySearchOption,
  remoteSearchAuthUsers,
  remoteSearchCustomerEntities,
  resolveCustomerEntityDisplayLabel,
  resolveResourceDisplayLabel,
  resolveUserDisplayLabel,
} from '../../procurement/lib/procurementEntitySearch'
import {
  remoteSearchInsurancePoliciesForCaseCustomer,
  remoteSearchPlaybooksForCase,
  remoteSearchProcurementProcessesForCaseCustomer,
  remoteSearchResourcesForCaseCustomer,
  resolvePlaybookTitleVersion,
} from '../lib/caseRelationsSearch'
import { formatProcedurePlaybookLabel } from '../lib/formatProcedurePlaybookLabel'

export type CaseCreateFormValues = {
  title: string
  customerEntityId: string
  playbookId: string
  resourceId: string
  procurementProcessId: string
  insurancePolicyId: string
  ownerUserId: string
  recurrenceEnabled: boolean
  recurrenceIntervalAmount: number | null
  recurrenceIntervalUnit: '' | 'hours' | 'days' | 'weeks' | 'months'
  recurrenceCreateLeadTimeAmount: number | null
  recurrenceCreateLeadTimeUnit: '' | 'hours' | 'days' | 'weeks' | 'months'
}

export type CaseFormTranslator = TranslateFn

function optionalRelationIdField() {
  return z.string().refine((s) => {
    const v = s.trim()
    return !v.length || z.string().uuid().safeParse(v).success
  }, { message: 'cases.form.errors.invalidUuid' })
}

export function caseCreateFormSchema() {
  return z.object({
    title: z.string().min(1).max(500),
    customerEntityId: optionalRelationIdField(),
    playbookId: optionalRelationIdField(),
    resourceId: optionalRelationIdField(),
    procurementProcessId: optionalRelationIdField(),
    insurancePolicyId: optionalRelationIdField(),
    ownerUserId: z.string().uuid({ message: 'cases.form.errors.ownerRequired' }),
    recurrenceEnabled: z.boolean(),
    recurrenceIntervalAmount: z.number().int().positive().nullish(),
    recurrenceIntervalUnit: z.enum(['', 'hours', 'days', 'weeks', 'months']),
    recurrenceCreateLeadTimeAmount: z.number().int().positive().nullish(),
    recurrenceCreateLeadTimeUnit: z.enum(['', 'hours', 'days', 'weeks', 'months']),
  }).superRefine((values, context) => {
    if (
      values.recurrenceEnabled &&
      (values.recurrenceIntervalAmount == null || !values.recurrenceIntervalUnit)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'cases.recurrence.intervalRequired',
        path: ['recurrenceIntervalAmount'],
      })
    }
    const hasLeadAmount = values.recurrenceCreateLeadTimeAmount != null
    const hasLeadUnit = Boolean(values.recurrenceCreateLeadTimeUnit)
    if (hasLeadAmount !== hasLeadUnit) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'cases.recurrence.leadTimeIncomplete',
        path: ['recurrenceCreateLeadTimeAmount'],
      })
    }
  })
}

export function defaultCaseCreateValues(): CaseCreateFormValues {
  return {
    title: '',
    customerEntityId: '',
    playbookId: '',
    resourceId: '',
    procurementProcessId: '',
    insurancePolicyId: '',
    ownerUserId: '',
    recurrenceEnabled: false,
    recurrenceIntervalAmount: null,
    recurrenceIntervalUnit: '',
    recurrenceCreateLeadTimeAmount: null,
    recurrenceCreateLeadTimeUnit: '',
  }
}

export function buildCaseCreateFormFields(t: CaseFormTranslator): CrudField[] {
  return [
    {
      id: 'ownerUserId',
      type: 'custom',
      label: t('cases.form.owner', 'Owner'),
      required: true,
      layout: 'half',
      component: ({ value, setValue, disabled }) => {
        const ownerUserId = typeof value === 'string' ? value : ''
        const [ownerLabel, setOwnerLabel] = React.useState(ownerUserId)
        React.useEffect(() => {
          let cancelled = false
          if (!ownerUserId.trim()) {
            setOwnerLabel('')
            return
          }
          void resolveUserDisplayLabel(ownerUserId).then((label) => {
            if (!cancelled) setOwnerLabel(label ?? ownerUserId)
          })
          return () => {
            cancelled = true
          }
        }, [ownerUserId])
        return (
          <EntitySearchCombobox
            value={ownerUserId}
            onChange={setValue}
            options={mergeEntitySearchOption([], ownerUserId, ownerLabel || ownerUserId)}
            onRemoteSearch={async (query) => {
              const rows = await remoteSearchAuthUsers(query)
              return mergeEntitySearchOption(rows, ownerUserId, ownerLabel || ownerUserId)
            }}
            placeholder={t('cases.form.ownerPlaceholder', 'Choose an owner…')}
            searchPlaceholder={t('cases.form.ownerSearch', 'Search users…')}
            disabled={disabled}
            createInNewTabHref="/backend/users/create"
            createInNewTabAriaLabel={t('cases.form.ownerAddUser', 'Create user in a new tab')}
          />
        )
      },
    },
    {
      id: 'title',
      type: 'text',
      label: t('cases.list.columns.title', 'Title'),
      required: true,
      layout: 'half',
    },
    {
      id: 'customerEntityId',
      type: 'custom',
      label: t('cases.form.customer', 'Customer'),
      required: false,
      layout: 'half',
      component: ({ value, setValue, setFormValue, disabled }) => {
        const str = typeof value === 'string' ? value : ''
        const [customerLabel, setCustomerLabel] = React.useState(str)
        const prevCustomerRef = React.useRef<string | undefined>(undefined)
        React.useEffect(() => {
          if (prevCustomerRef.current === undefined) {
            prevCustomerRef.current = str
            return
          }
          if (prevCustomerRef.current !== str && typeof setFormValue === 'function') {
            setFormValue('resourceId', '')
            setFormValue('procurementProcessId', '')
            setFormValue('insurancePolicyId', '')
          }
          prevCustomerRef.current = str
        }, [str, setFormValue])
        React.useEffect(() => {
          let cancelled = false
          if (!str.trim()) {
            setCustomerLabel('')
            return
          }
          void resolveCustomerEntityDisplayLabel(str).then((label) => {
            if (!cancelled) setCustomerLabel(label ?? str)
          })
          return () => {
            cancelled = true
          }
        }, [str])
        return (
          <EntitySearchCombobox
            value={str}
            onChange={(next) => setValue(next)}
            options={mergeEntitySearchOption([], str, customerLabel || str)}
            onRemoteSearch={async (q) => {
              const rows = await remoteSearchCustomerEntities(q)
              return mergeEntitySearchOption(rows, str, customerLabel || str)
            }}
            placeholder={t('cases.form.customerSearch', 'Search customers…')}
            disabled={disabled}
            createInNewTabHref="/backend/customers/companies/create"
            createInNewTabAriaLabel={t('cases.form.customerAddCompanyTab', 'Open new company form in a new tab')}
          />
        )
      },
    },
    {
      id: 'playbookId',
      type: 'custom',
      label: t('cases.form.procedure.playbook', 'Procedure'),
      layout: 'full',
      component: ({ value, setValue, disabled }) => {
        const str = typeof value === 'string' ? value : ''
        const [playbookLabel, setPlaybookLabel] = React.useState('')
        React.useEffect(() => {
          let cancelled = false
          if (!str.trim().length || !z.string().uuid().safeParse(str.trim()).success) {
            setPlaybookLabel('')
            return
          }
          void resolvePlaybookTitleVersion(str.trim()).then((row) => {
            if (!cancelled) {
              setPlaybookLabel(row ? formatProcedurePlaybookLabel(row.title, row.version, t) : '')
            }
          })
          return () => {
            cancelled = true
          }
        }, [str, t])
        const resolvedMergeLabel = playbookLabel.trim().length ? playbookLabel : str
        return (
          <EntitySearchCombobox
            value={str}
            onChange={(next) => setValue(next)}
            options={mergeEntitySearchOption([], str, resolvedMergeLabel)}
            onRemoteSearch={async (q) => {
              const rows = await remoteSearchPlaybooksForCase(q, (title, version) =>
                formatProcedurePlaybookLabel(title, version ?? null, t))
              return mergeEntitySearchOption(rows, str, resolvedMergeLabel)
            }}
            placeholder={t('cases.form.procedure.playbookSearch', 'Search procedures…')}
            disabled={disabled}
            createInNewTabHref="/backend/playbooks/create"
            createInNewTabAriaLabel={t(
              'cases.form.procedure.openNewPlaybookTab',
              'Open new procedure in a new tab',
            )}
          />
        )
      },
    },
    {
      id: 'resourceId',
      type: 'custom',
      label: t('cases.form.relations.resource', 'Resource'),
      layout: 'full',
      component: ({ value, setValue, disabled, values }) => {
        const str = typeof value === 'string' ? value : ''
        const customerRaw = values?.customerEntityId
        const customerId = typeof customerRaw === 'string' ? customerRaw.trim() : ''
        const hasCustomer = z.string().uuid().safeParse(customerId).success
        const [resourceLabel, setResourceLabel] = React.useState('')
        React.useEffect(() => {
          let cancelled = false
          if (!str.trim().length || !z.string().uuid().safeParse(str.trim()).success) {
            setResourceLabel('')
            return
          }
          void resolveResourceDisplayLabel(str.trim()).then((label) => {
            if (!cancelled) setResourceLabel(label ?? '')
          })
          return () => {
            cancelled = true
          }
        }, [str])
        const resolvedMergeLabel = resourceLabel.trim().length ? resourceLabel : str
        return (
          <EntitySearchCombobox
            value={str}
            onChange={(next) => setValue(next)}
            options={mergeEntitySearchOption([], str, resolvedMergeLabel)}
            onRemoteSearch={async (q) => {
              const rows = await remoteSearchResourcesForCaseCustomer(customerId, q)
              return mergeEntitySearchOption(rows, str, resolvedMergeLabel)
            }}
            placeholder={
              hasCustomer
                ? t('cases.form.relations.resourceSearch', 'Search resources…')
                : t(
                    'cases.form.relations.resourceSearchUnassigned',
                    'Search resources without a linked customer…',
                  )
            }
            disabled={disabled}
          />
        )
      },
    },
    {
      id: 'procurementProcessId',
      type: 'custom',
      label: t('cases.form.relations.procurementProcess', 'Purchase process'),
      layout: 'full',
      component: ({ value, setValue, disabled, values }) => {
        const str = typeof value === 'string' ? value : ''
        const customerRaw = values?.customerEntityId
        const customerId = typeof customerRaw === 'string' ? customerRaw.trim() : ''
        const hasCustomer = z.string().uuid().safeParse(customerId).success
        return (
          <EntitySearchCombobox
            value={str}
            onChange={(next) => setValue(next)}
            options={mergeEntitySearchOption([], str, str)}
            onRemoteSearch={async (q) => {
              const rows = await remoteSearchProcurementProcessesForCaseCustomer(customerId, q)
              return mergeEntitySearchOption(rows, str, str)
            }}
            placeholder={
              hasCustomer
                ? t('cases.form.relations.procurementProcessSearch', 'Search purchase processes…')
                : t(
                    'cases.form.relations.procurementProcessSearchUnassigned',
                    'Search purchase processes without a linked customer…',
                  )
            }
            disabled={disabled}
          />
        )
      },
    },
    {
      id: 'insurancePolicyId',
      type: 'custom',
      label: t('cases.form.relations.insurancePolicy', 'Insurance policy'),
      layout: 'full',
      component: ({ value, setValue, disabled, values }) => {
        const str = typeof value === 'string' ? value : ''
        const customerRaw = values?.customerEntityId
        const customerId = typeof customerRaw === 'string' ? customerRaw.trim() : ''
        return (
          <EntitySearchCombobox
            value={str}
            onChange={(next) => setValue(next)}
            options={mergeEntitySearchOption([], str, str)}
            onRemoteSearch={async (q) => {
              const rows = await remoteSearchInsurancePoliciesForCaseCustomer(customerId, q)
              return mergeEntitySearchOption(rows, str, str)
            }}
            placeholder={t('cases.form.relations.insurancePolicySearch', 'Search policies by number…')}
            disabled={disabled}
          />
        )
      },
    },
    {
      id: 'recurrenceEnabled',
      type: 'checkbox',
      label: t('cases.recurrence.enabled', 'Recurring case'),
      layout: 'full',
    },
    {
      id: 'recurrenceIntervalAmount',
      type: 'number',
      label: t('cases.recurrence.intervalAmount', 'Repeat every'),
      layout: 'half',
    },
    {
      id: 'recurrenceIntervalUnit',
      type: 'select',
      label: t('cases.recurrence.intervalUnit', 'Interval unit'),
      layout: 'half',
      options: [
        { value: '', label: t('cases.recurrence.selectUnit', 'Select unit…') },
        { value: 'hours', label: t('cases.duration.hours', 'Hours') },
        { value: 'days', label: t('cases.duration.days', 'Days') },
        { value: 'weeks', label: t('cases.duration.weeks', 'Weeks') },
        { value: 'months', label: t('cases.duration.months', 'Months') },
      ],
    },
    {
      id: 'recurrenceCreateLeadTimeAmount',
      type: 'number',
      label: t('cases.recurrence.leadTimeAmount', 'Create ahead by'),
      layout: 'half',
    },
    {
      id: 'recurrenceCreateLeadTimeUnit',
      type: 'select',
      label: t('cases.recurrence.leadTimeUnit', 'Lead time unit'),
      layout: 'half',
      options: [
        { value: '', label: t('cases.recurrence.selectUnit', 'Select unit…') },
        { value: 'hours', label: t('cases.duration.hours', 'Hours') },
        { value: 'days', label: t('cases.duration.days', 'Days') },
        { value: 'weeks', label: t('cases.duration.weeks', 'Weeks') },
        { value: 'months', label: t('cases.duration.months', 'Months') },
      ],
    },
  ]
}

export function buildCaseCreateFormGroups(t: CaseFormTranslator): CrudFormGroup[] {
  return [
    {
      id: 'basics',
      title: t('cases.form.groups.basics', 'Basics'),
      column: 1,
      fields: ['title', 'customerEntityId', 'ownerUserId'],
    },
    {
      id: 'procedure',
      title: t('cases.form.groups.procedure', 'Procedure'),
      column: 2,
      fields: ['playbookId'],
    },
    {
      id: 'relations',
      title: t('cases.form.groups.relations', 'Relations'),
      column: 2,
      fields: ['resourceId', 'procurementProcessId', 'insurancePolicyId'],
    },
    {
      id: 'recurrence',
      title: t('cases.form.groups.recurrence', 'Recurrence'),
      column: 2,
      fields: [
        'recurrenceEnabled',
        'recurrenceIntervalAmount',
        'recurrenceIntervalUnit',
        'recurrenceCreateLeadTimeAmount',
        'recurrenceCreateLeadTimeUnit',
      ],
    },
  ]
}
