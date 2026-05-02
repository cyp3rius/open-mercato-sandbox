'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudCustomFieldRenderProps, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { Input } from '@open-mercato/ui/primitives/input'
import type { AccountingInvoiceKind } from '../lib/constants'
import { ACCOUNTING_INVOICE_ENTITY_ID } from '../lib/constants'

type AccountingInvoiceImportFormProps = {
  usage: Extract<AccountingInvoiceKind, 'imported_cost' | 'imported_sales'>
}

type InvoiceImportFormValues = {
  documentNumber: string
  issueDate: string
  counterpartyName: string
  currencyCode: string
  totalAmount: string
  externalReference: string
  sourceSystem: string
  notes: string
  invoiceFile: File | null
}

function ImportFileField({ value, setValue, disabled }: CrudCustomFieldRenderProps) {
  const t = useT()
  const file = value instanceof File ? value : null
  return (
    <div className="space-y-2">
      <Input
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        disabled={Boolean(disabled)}
        onChange={(event) => {
          const next = event.target.files?.item(0) ?? null
          setValue(next)
        }}
      />
      <p className="text-xs text-muted-foreground">
        {file ? file.name : t('accounting.import.form.fileHelp', 'Upload one invoice file (PDF or image).')}
      </p>
    </div>
  )
}

export function AccountingInvoiceImportForm({ usage }: AccountingInvoiceImportFormProps) {
  const t = useT()
  const router = useRouter()
  const { organizationId, tenantId } = useOrganizationScopeDetail()
  const backHref = '/backend/accounting/invoices'

  const title =
    usage === 'imported_cost'
      ? t('accounting.import.cost.title', 'Import cost invoice')
      : t('accounting.import.sales.title', 'Import sales invoice')

  const groups = React.useMemo<CrudFormGroup[]>(
    () => [
      {
        id: 'basics',
        column: 1,
        title: t('accounting.form.groups.basics', 'Basics'),
        fields: [
          {
            id: 'documentNumber',
            type: 'text',
            required: true,
            label: t('accounting.form.fields.documentNumber', 'Invoice number'),
          },
          {
            id: 'issueDate',
            type: 'date',
            required: true,
            label: t('accounting.form.fields.issueDate', 'Issue date'),
          },
          {
            id: 'counterpartyName',
            type: 'text',
            label: t('accounting.form.fields.counterpartyName', 'Counterparty'),
          },
          {
            id: 'currencyCode',
            type: 'text',
            maxLength: 3,
            label: t('accounting.form.fields.currencyCode', 'Currency code'),
          },
          {
            id: 'totalAmount',
            type: 'number',
            step: '0.01',
            min: 0,
            label: t('accounting.form.fields.totalAmount', 'Total amount'),
          },
        ],
      },
      {
        id: 'details',
        column: 2,
        title: t('accounting.form.groups.details', 'Details'),
        fields: [
          {
            id: 'externalReference',
            type: 'text',
            label: t('accounting.form.fields.externalReference', 'External reference'),
          },
          {
            id: 'sourceSystem',
            type: 'text',
            label: t('accounting.form.fields.sourceSystem', 'Source system'),
          },
          {
            id: 'notes',
            type: 'textarea',
            label: t('accounting.form.fields.notes', 'Notes'),
          },
          {
            id: 'invoiceFile',
            type: 'custom',
            required: true,
            label: t('accounting.form.fields.invoiceFile', 'Invoice file'),
            component: (props) => <ImportFileField {...props} />,
          },
        ],
      },
    ],
    [t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm<InvoiceImportFormValues>
          title={title}
          backHref={backHref}
          cancelHref={backHref}
          fields={[]}
          groups={groups}
          submitLabel={t('accounting.form.actions.import', 'Import invoice')}
          initialValues={{
            documentNumber: '',
            issueDate: new Date().toISOString().slice(0, 10),
            counterpartyName: '',
            currencyCode: 'PLN',
            totalAmount: '',
            externalReference: '',
            sourceSystem: '',
            notes: '',
            invoiceFile: null,
          }}
          onSubmit={async (values) => {
            const file = values.invoiceFile instanceof File ? values.invoiceFile : null
            if (!file) {
              throw new Error(t('accounting.import.form.fileRequired', 'Invoice file is required.'))
            }

            const createCall = await createCrud<{ id: string }>('accounting/invoices', {
              organizationId,
              tenantId,
              documentKind: usage,
              isDraft: false,
              documentNumber: String(values.documentNumber ?? '').trim(),
              issueDate: String(values.issueDate ?? '').trim(),
              counterpartyName: String(values.counterpartyName ?? '').trim() || null,
              currencyCode: String(values.currencyCode ?? '').trim().toUpperCase() || null,
              totalAmount:
                values.totalAmount === null || values.totalAmount === undefined || values.totalAmount === ''
                  ? null
                  : String(values.totalAmount),
              sourceSystem: String(values.sourceSystem ?? '').trim() || null,
              externalReference: String(values.externalReference ?? '').trim() || null,
              notes: String(values.notes ?? '').trim() || null,
            })

            const invoiceId = String(createCall.result?.id ?? '')
            if (!invoiceId) throw new Error(t('accounting.import.form.createFailed', 'Failed to create invoice record.'))

            const formData = new FormData()
            formData.set('entityId', ACCOUNTING_INVOICE_ENTITY_ID)
            formData.set('recordId', invoiceId)
            formData.set('file', file)

            const uploadCall = await apiCall<{ error?: string }>(
              '/api/attachments',
              { method: 'POST', body: formData },
              { fallback: null },
            )
            if (!uploadCall.ok) {
              throw new Error(uploadCall.result?.error || t('accounting.import.form.uploadFailed', 'Upload failed.'))
            }

            flash(t('accounting.flash.imported', 'Invoice imported.'), 'success')
            router.push(`/backend/accounting/invoices/${encodeURIComponent(invoiceId)}`)
          }}
        />
      </PageBody>
    </Page>
  )
}
