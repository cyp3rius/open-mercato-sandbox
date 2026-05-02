'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ApplyBreadcrumb } from '@open-mercato/ui/backend/AppShell'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { isInvoiceNumberingModeId } from '../../../../../lib/sellingEntityConstants'
import {
  bankAccountsFromApi,
  bankAccountsToPayload,
  buildSellingEntityFormFields,
  buildSellingEntityFormGroups,
  defaultSellingEntityInitialValues,
  type SellingEntityFormValues,
} from '../../../../../components/sellingEntityFormConfig'

/** Ostatni segment breadcrumba — po przekroczeniu maxLen dodaje „…”. */
function truncateSellingEntityBreadcrumbName(name: string, maxLen = 20): string {
  const s = name.trim()
  const base = s.length ? s : '—'
  if (base.length <= maxLen) return base
  return `${base.slice(0, maxLen)}…`
}

type Row = {
  id: string
  name: string
  nip: string | null
  regon: string | null
  address: string | null
  bankAccounts: Array<{ accountNumber: string; label?: string | null; currencyCode?: string | null }> | null
  invoiceNumberingMode: string
  invoiceNumberingCustom: string | null
}

export default function SellingEntityDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const { organizationId, tenantId } = useOrganizationScopeDetail()
  const [row, setRow] = React.useState<Row | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [formKey, setFormKey] = React.useState(0)

  const id = params?.id

  const load = React.useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    const call = await apiCall<{ items?: Row[] }>(
      `/api/accounting/selling-entities?id=${encodeURIComponent(id)}&pageSize=1`,
    )
    if (!call.ok) {
      setError(t('accounting.settings.entities.detail.notFound', 'Company not found.'))
      setRow(null)
      setLoading(false)
      return
    }
    const items = Array.isArray(call.result?.items) ? call.result.items : []
    setRow(items[0] ?? null)
    if (!items[0]) setError(t('accounting.settings.entities.detail.notFound', 'Company not found.'))
    setLoading(false)
  }, [id, t])

  React.useEffect(() => {
    void load()
  }, [load])

  const fields = React.useMemo(() => buildSellingEntityFormFields(t), [t])
  const groups = React.useMemo(() => buildSellingEntityFormGroups(t), [t])

  const sellingEntityDetailBreadcrumb = React.useMemo(() => {
    const displayName = row?.name ?? ''
    return [
      { label: 'Accounting', labelKey: 'accounting.hub.title', href: '/backend/accounting' },
      { label: 'Settings', labelKey: 'accounting.settings.hub.title', href: '/backend/config/accounting' },
      {
        label: 'Selling companies',
        labelKey: 'accounting.settings.entities.list.title',
        href: '/backend/config/accounting/entities',
      },
      { label: truncateSellingEntityBreadcrumbName(displayName) },
    ]
  }, [row?.name])

  const initialValues = React.useMemo((): SellingEntityFormValues => {
    if (!row) {
      return defaultSellingEntityInitialValues()
    }
    const mode = isInvoiceNumberingModeId(row.invoiceNumberingMode) ? row.invoiceNumberingMode : 'seq_only'
    return {
      name: row.name,
      nip: row.nip ?? '',
      regon: row.regon ?? '',
      address: row.address ?? '',
      bankAccounts: bankAccountsFromApi(row.bankAccounts),
      invoiceNumberingMode: mode,
      invoiceNumberingCustom: row.invoiceNumberingCustom ?? '',
    }
  }, [row])

  const handleDelete = React.useCallback(async () => {
    if (!row) return
    const ok = await confirm({
      title: t('accounting.settings.entities.detail.confirmDelete', 'Delete this company?'),
      text: t(
        'accounting.settings.entities.detail.confirmDeleteMessage',
        'This cannot be undone. Invoices that reference it keep copied data only.',
      ),
      variant: 'destructive',
    })
    if (!ok) return
    await deleteCrud('accounting/selling-entities', row.id, {
      errorMessage: t('accounting.settings.entities.form.deleteError', 'Could not delete company.'),
    })
    flash(t('accounting.settings.entities.flash.deleted', 'Company removed.'), 'success')
    router.push('/backend/config/accounting/entities')
  }, [confirm, row, router, t])

  if (loading) {
    return (
      <Page>
        <PageBody>
          <p className="text-sm text-muted-foreground">
            {t('accounting.settings.entities.detail.loading', 'Loading…')}
          </p>
        </PageBody>
        {ConfirmDialogElement}
      </Page>
    )
  }

  if (error || !row) {
    return (
      <Page>
        <PageBody>
          <p className="text-sm text-destructive">
            {error || t('accounting.settings.entities.detail.notFound', 'Not found')}
          </p>
        </PageBody>
        {ConfirmDialogElement}
      </Page>
    )
  }

  return (
    <>
      <ApplyBreadcrumb
        breadcrumb={sellingEntityDetailBreadcrumb}
        title={truncateSellingEntityBreadcrumbName(row.name)}
      />
      <Page>
        <PageBody>
          <CrudForm<SellingEntityFormValues>
            key={formKey}
            title={t('accounting.settings.entities.detail.title', 'Selling company')}
            backHref="/backend/config/accounting/entities"
            cancelHref="/backend/config/accounting/entities"
            submitLabel={t('accounting.settings.entities.form.save', 'Save changes')}
            fields={fields}
            groups={groups}
            initialValues={initialValues}
            onDelete={handleDelete}
            onSubmit={async (values) => {
              await updateCrud(
                'accounting/selling-entities',
                {
                  id: row.id,
                  name: String(values.name ?? '').trim(),
                  nip: String(values.nip ?? '').trim() || null,
                  regon: String(values.regon ?? '').trim() || null,
                  address: String(values.address ?? '').trim() || null,
                  bankAccounts: bankAccountsToPayload(values.bankAccounts ?? []),
                  invoiceNumberingMode: values.invoiceNumberingMode,
                  invoiceNumberingCustom: String(values.invoiceNumberingCustom ?? '').trim() || null,
                  organizationId,
                  tenantId,
                },
                { errorMessage: t('accounting.settings.entities.form.saveError', 'Could not save company.') },
              )
              flash(t('accounting.settings.entities.flash.updated', 'Changes saved.'), 'success')
              setFormKey((k) => k + 1)
              void load()
            }}
          />
        </PageBody>
        {ConfirmDialogElement}
      </Page>
    </>
  )
}
