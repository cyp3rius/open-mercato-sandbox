'use client'

import * as React from 'react'
import { z } from 'zod'
import type { TranslateFn } from '@open-mercato/shared/lib/i18n/context'
import type { CrudField, CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { EntitySearchCombobox } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import {
  mergeEntitySearchOption,
  remoteSearchCustomerEntities,
  resolveResourceDisplayLabel,
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
    customerEntityId: z.string().uuid(),
    playbookId: optionalRelationIdField(),
    resourceId: optionalRelationIdField(),
    procurementProcessId: optionalRelationIdField(),
    insurancePolicyId: optionalRelationIdField(),
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
  }
}

export function buildCaseCreateFormFields(t: CaseFormTranslator): CrudField[] {
  return [
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
      required: true,
      layout: 'half',
      component: ({ value, setValue, setFormValue, disabled }) => {
        const str = typeof value === 'string' ? value : ''
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
        return (
          <EntitySearchCombobox
            value={str}
            onChange={(next) => setValue(next)}
            options={mergeEntitySearchOption([], str, str)}
            onRemoteSearch={async (q) => {
              const rows = await remoteSearchCustomerEntities(q)
              return mergeEntitySearchOption(rows, str, str)
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
        const hasCustomer = z.string().uuid().safeParse(customerId).success
        return (
          <EntitySearchCombobox
            value={str}
            onChange={(next) => setValue(next)}
            options={mergeEntitySearchOption([], str, str)}
            onRemoteSearch={async (q) => {
              const rows = await remoteSearchInsurancePoliciesForCaseCustomer(customerId, q)
              return mergeEntitySearchOption(rows, str, str)
            }}
            placeholder={
              hasCustomer
                ? t('cases.form.relations.insurancePolicySearch', 'Search policies by number…')
                : t('cases.form.relations.selectCustomerFirst', 'Select a customer first…')
            }
            disabled={disabled || !hasCustomer}
          />
        )
      },
    },
  ]
}

export function buildCaseCreateFormGroups(t: CaseFormTranslator): CrudFormGroup[] {
  return [
    {
      id: 'basics',
      title: t('cases.form.groups.basics', 'Basics'),
      column: 1,
      fields: ['title', 'customerEntityId'],
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
  ]
}
