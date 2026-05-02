'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { AttachmentsSection } from '@open-mercato/ui/backend/detail/AttachmentsSection'
import { ACCOUNTING_INVOICE_ENTITY_ID } from '../../../../lib/constants'

type AccountingInvoice = {
  id: string
  documentNumber: string
  documentKind: 'issued' | 'imported_cost' | 'imported_sales'
  issueDate: string
  title: string | null
  counterpartyName: string | null
  externalReference: string | null
  currencyCode: string | null
  totalAmount: string | null
  sourceSystem: string | null
  notes: string | null
}
type InvoiceDetailFormValues = {
  documentNumber: string
  issueDate: string
  title: string
  counterpartyName: string
  externalReference: string
  currencyCode: string
  totalAmount: string
  sourceSystem: string
  notes: string
}

export default function AccountingInvoiceDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [invoice, setInvoice] = React.useState<AccountingInvoice | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const loadInvoice = React.useCallback(async () => {
    const id = params?.id
    if (!id) return
    setLoading(true)
    setError(null)
    const call = await apiCall<{ items?: AccountingInvoice[] }>(`/api/accounting/invoices?id=${encodeURIComponent(id)}`)
    if (!call.ok) {
      setError(t('accounting.detail.notFound', 'Invoice not found.'))
      setLoading(false)
      return
    }
    const items = Array.isArray(call.result?.items) ? call.result.items : []
    setInvoice(items[0] ?? null)
    if (!items[0]) setError(t('accounting.detail.notFound', 'Invoice not found.'))
    setLoading(false)
  }, [params?.id, t])

  React.useEffect(() => {
    void loadInvoice()
  }, [loadInvoice])

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
            id: 'title',
            type: 'text',
            label: t('accounting.form.fields.title', 'Title'),
          },
        ],
      },
      {
        id: 'details',
        column: 2,
        title: t('accounting.form.groups.details', 'Details'),
        fields: [
          {
            id: 'currencyCode',
            type: 'text',
            maxLength: 3,
            label: t('accounting.form.fields.currencyCode', 'Currency code'),
          },
          {
            id: 'totalAmount',
            type: 'number',
            min: 0,
            step: '0.01',
            label: t('accounting.form.fields.totalAmount', 'Total amount'),
          },
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
        ],
      },
    ],
    [t],
  )

  const handleDelete = React.useCallback(async () => {
    if (!invoice) return
    const ok = await confirm({
      title: t('accounting.detail.confirmDelete', { number: invoice.documentNumber }),
      variant: 'destructive',
    })
    if (!ok) return

    await deleteCrud('accounting/invoices', { id: invoice.id })
    flash(t('accounting.flash.deleted', 'Invoice deleted.'), 'success')
    router.push('/backend/accounting/invoices')
  }, [confirm, invoice, router, t])

  if (loading) {
    return (
      <Page>
        <PageBody>
          <div className="text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</div>
        </PageBody>
        {ConfirmDialogElement}
      </Page>
    )
  }

  if (!invoice) {
    return (
      <Page>
        <PageBody>
          <p className="text-destructive">{error || t('accounting.detail.notFound', 'Invoice not found.')}</p>
        </PageBody>
        {ConfirmDialogElement}
      </Page>
    )
  }

  return (
    <Page>
      <PageBody className="space-y-4">
        <CrudForm<InvoiceDetailFormValues>
          title={t('accounting.detail.title', 'Invoice details')}
          backHref="/backend/accounting/invoices"
          cancelHref="/backend/accounting/invoices"
          submitLabel={t('accounting.form.actions.save', 'Save')}
          onDelete={handleDelete}
          fields={[]}
          groups={groups}
          initialValues={{
            documentNumber: invoice.documentNumber,
            issueDate: invoice.issueDate,
            title: invoice.title || '',
            counterpartyName: invoice.counterpartyName || '',
            externalReference: invoice.externalReference || '',
            currencyCode: invoice.currencyCode || '',
            totalAmount: invoice.totalAmount || '',
            sourceSystem: invoice.sourceSystem || '',
            notes: invoice.notes || '',
          }}
          onSubmit={async (values) => {
            await updateCrud('accounting/invoices', {
              id: invoice.id,
              documentNumber: String(values.documentNumber ?? '').trim(),
              issueDate: String(values.issueDate ?? '').trim(),
              title: String(values.title ?? '').trim() || null,
              counterpartyName: String(values.counterpartyName ?? '').trim() || null,
              externalReference: String(values.externalReference ?? '').trim() || null,
              currencyCode: String(values.currencyCode ?? '').trim().toUpperCase() || null,
              totalAmount:
                values.totalAmount === null || values.totalAmount === undefined || values.totalAmount === ''
                  ? null
                  : String(values.totalAmount),
              sourceSystem: String(values.sourceSystem ?? '').trim() || null,
              notes: String(values.notes ?? '').trim() || null,
            })
            flash(t('accounting.flash.updated', 'Invoice updated.'), 'success')
            await loadInvoice()
          }}
        />

        <AttachmentsSection
          entityId={ACCOUNTING_INVOICE_ENTITY_ID}
          recordId={invoice.id}
          title={t('accounting.detail.attachments.title', 'Invoice files')}
          description={t('accounting.detail.attachments.description', 'Add or replace files linked with this invoice.')}
        />
      </PageBody>
      {ConfirmDialogElement}
    </Page>
  )
}
