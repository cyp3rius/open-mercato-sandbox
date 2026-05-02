'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import {
  CrudForm,
  CRUD_FORM_SELECT_CLASS,
  CRUD_FORM_TEXT_INPUT_CLASS,
  type CrudCustomFieldRenderProps,
  type CrudField,
  type CrudFormGroup,
} from '@open-mercato/ui/backend/CrudForm'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { Button } from '@open-mercato/ui/primitives/button'
import { IconButton } from '@open-mercato/ui/primitives/icon-button'
import { cn } from '@open-mercato/shared/lib/utils'
import Link from 'next/link'
import { InvoiceBuyerField } from '../../../../components/InvoiceBuyerField'
import { InvoiceSellerField } from '../../../../components/InvoiceSellerField'
import { BankAccountValidationHints } from '../../../../components/BankAccountValidationHints'
import { canonicalBankAccountForSelect } from '../../../../lib/sellingEntitySearch'
import { Plus, Settings, Trash2 } from 'lucide-react'

type InvoiceCreateFormValues = {
  documentNumber: string
  issueDate: string
  salesDate: string
  paymentTermDays: string
  sellerEntityId: string
  sellerName: string
  sellerNip: string
  sellerRegon: string
  sellerAddress: string
  buyerEntityId: string
  buyerName: string
  buyerNip: string
  buyerRegon: string
  buyerAddress: string
  lineItems: InvoiceLineDraft[]
  paymentMethod: 'cash' | 'transfer' | 'card'
  paymentAccount: string
  currencyCode: string
  externalReference: string
  notes: string
}

type InvoiceLineDraft = {
  id: string
  name: string
  unit: string
  quantity: string
  unitPriceNet: string
  taxRate: string
}

function blankLine(): InvoiceLineDraft {
  return {
    id: crypto.randomUUID(),
    name: '',
    unit: 'szt.',
    quantity: '1',
    unitPriceNet: '',
    taxRate: '23',
  }
}

function toNumber(value: string): number {
  const normalized = value.replace(',', '.').trim()
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return 0
  return parsed
}

function sumGross(
  lines: Array<{ quantity: string; unitPriceNet: string; taxRate: string }>,
): number {
  return lines.reduce((acc, line) => {
    const quantity = toNumber(line.quantity)
    const unitNet = toNumber(line.unitPriceNet)
    const taxRate = toNumber(line.taxRate)
    const net = quantity * unitNet
    const gross = net * (1 + taxRate / 100)
    return acc + gross
  }, 0)
}

function addDays(dateIso: string, days: number): string {
  const base = new Date(dateIso)
  if (Number.isNaN(base.getTime())) return dateIso
  base.setDate(base.getDate() + days)
  return base.toISOString().slice(0, 10)
}

/** Fills `documentNumber` from selling-entity template + `nextInvoiceSeq` when a saved seller and issue date are set. */
function InvoiceDocumentNumberSyncField({ values, setFormValue }: CrudCustomFieldRenderProps) {
  const seller = typeof values?.sellerEntityId === 'string' ? values.sellerEntityId.trim() : ''
  const issue = typeof values?.issueDate === 'string' ? values.issueDate : ''
  const issueOk = /^\d{4}-\d{2}-\d{2}$/.test(issue)

  React.useEffect(() => {
    if (!seller || !issueOk) return
    let cancelled = false
    void (async () => {
      const call = await apiCall<{ documentNumber?: string }>(
        `/api/accounting/selling-entities/next-invoice-number?${new URLSearchParams({
          entityId: seller,
          issueDate: issue,
        }).toString()}`,
      )
      if (cancelled || !call.ok || !call.result) return
      const payload = call.result as { documentNumber?: string }
      const num = typeof payload.documentNumber === 'string' ? payload.documentNumber : ''
      if (num) setFormValue?.('documentNumber', num)
    })()
    return () => {
      cancelled = true
    }
  }, [seller, issue, issueOk, setFormValue])
  return null
}

function LineItemsEditor({ value, setValue, disabled, values }: CrudCustomFieldRenderProps) {
  const t = useT()
  const rows = Array.isArray(value) ? (value as InvoiceLineDraft[]) : []
  const safeRows = rows.length > 0 ? rows : [blankLine()]
  const currencyRaw = values && typeof values.currencyCode === 'string' ? values.currencyCode.trim().toUpperCase() : 'PLN'
  const currency = currencyRaw.length > 0 ? currencyRaw : 'PLN'

  const updateRow = (id: string, patch: Partial<InvoiceLineDraft>) => {
    setValue(
      safeRows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    )
  }

  const removeRow = (id: string) => {
    const next = safeRows.filter((row) => row.id !== id)
    setValue(next.length ? next : [blankLine()])
  }

  const totalGross = sumGross(safeRows)

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t('accounting.form.items.name', 'Name')}</th>
                <th className="w-24 px-3 py-2 font-medium">{t('accounting.form.items.unit', 'Unit')}</th>
                <th className="w-24 px-3 py-2 font-medium">{t('accounting.form.items.quantity', 'Qty')}</th>
                <th className="w-36 px-3 py-2 font-medium">{t('accounting.form.items.unitPriceNet', 'Net price')}</th>
                <th className="w-24 px-3 py-2 font-medium">{t('accounting.form.items.taxRate', 'VAT %')}</th>
                <th className="w-12 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {safeRows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-3 py-2 align-middle">
                    <input
                      type="text"
                      className={CRUD_FORM_TEXT_INPUT_CLASS}
                      value={row.name}
                      disabled={disabled}
                      onChange={(event) => updateRow(row.id, { name: event.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <input
                      type="text"
                      className={CRUD_FORM_TEXT_INPUT_CLASS}
                      value={row.unit}
                      disabled={disabled}
                      onChange={(event) => updateRow(row.id, { unit: event.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <input
                      type="text"
                      inputMode="decimal"
                      className={CRUD_FORM_TEXT_INPUT_CLASS}
                      value={row.quantity}
                      disabled={disabled}
                      onChange={(event) => updateRow(row.id, { quantity: event.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <input
                      type="text"
                      inputMode="decimal"
                      className={CRUD_FORM_TEXT_INPUT_CLASS}
                      value={row.unitPriceNet}
                      disabled={disabled}
                      onChange={(event) => updateRow(row.id, { unitPriceNet: event.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <input
                      type="text"
                      inputMode="decimal"
                      className={CRUD_FORM_TEXT_INPUT_CLASS}
                      value={row.taxRate}
                      disabled={disabled}
                      onChange={(event) => updateRow(row.id, { taxRate: event.target.value })}
                    />
                  </td>
                  <td className="px-2 py-2 align-middle">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={disabled}
                      onClick={() => removeRow(row.id)}
                      className="shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setValue([...safeRows, blankLine()])}>
          <Plus className="mr-2 h-4 w-4" />
          {t('accounting.form.items.add', 'Add line')}
        </Button>
        <div className="text-sm font-medium tabular-nums text-foreground">
          {t('accounting.form.items.totalGross', 'Gross total')}: {totalGross.toFixed(2)} {currency}
        </div>
      </div>
    </div>
  )
}

function PaymentAccountField({
  value,
  setValue,
  values,
  disabled,
  sellerBankAccounts,
}: CrudCustomFieldRenderProps & { sellerBankAccounts: string[] }) {
  const t = useT()
  const current = typeof value === 'string' ? value : ''

  React.useEffect(() => {
    const pm = values && values.paymentMethod === 'transfer' ? 'transfer' : values?.paymentMethod
    if (pm !== 'transfer' || !sellerBankAccounts.length || !current.trim()) return
    if (sellerBankAccounts.includes(current)) return
    const aligned = canonicalBankAccountForSelect(current, sellerBankAccounts)
    if (aligned && sellerBankAccounts.includes(aligned) && aligned !== current) {
      setValue(aligned)
    }
  }, [values?.paymentMethod, sellerBankAccounts, current, setValue])

  const paymentMethod = values && values.paymentMethod === 'transfer' ? 'transfer' : values?.paymentMethod
  if (paymentMethod !== 'transfer') {
    return (
      <p className="text-sm text-muted-foreground">
        {t('accounting.form.payment.transferOnly', 'Bank account is required only for transfer payments.')}
      </p>
    )
  }
  if (!sellerBankAccounts.length) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {t('accounting.form.payment.noSellerAccounts', 'No configured accounts for selected seller. Enter account number manually.')}
        </p>
        <input
          type="text"
          className={CRUD_FORM_TEXT_INPUT_CLASS}
          value={current}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          autoComplete="off"
        />
        <BankAccountValidationHints accountNumber={current} disabled={disabled} />
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <select
        className={cn(CRUD_FORM_SELECT_CLASS, 'bg-background')}
        value={current}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
      >
        <option value="">{t('accounting.form.payment.selectAccount', 'Select account')}</option>
        {sellerBankAccounts.map((account) => (
          <option key={account} value={account}>
            {account}
          </option>
        ))}
      </select>
      <BankAccountValidationHints accountNumber={current} disabled={disabled} />
    </div>
  )
}

export default function CreateAccountingInvoicePage() {
  const t = useT()
  const router = useRouter()
  const { organizationId, tenantId } = useOrganizationScopeDetail()
  const [sellerBankAccounts, setSellerBankAccounts] = React.useState<string[]>([])

  const renderSellerField = React.useCallback((props: CrudCustomFieldRenderProps) => {
    return <InvoiceSellerField {...props} onBankAccountsChange={setSellerBankAccounts} />
  }, [])

  const fields = React.useMemo<CrudField[]>(
    () => [
      {
        id: '__docNumberSync',
        type: 'custom',
        label: '',
        layout: 'full',
        component: InvoiceDocumentNumberSyncField,
      },
      {
        id: 'documentNumber',
        type: 'text',
        required: true,
        label: t('accounting.form.fields.documentNumber', 'Invoice number'),
        layout: 'quarter',
      },
      {
        id: 'issueDate',
        type: 'date',
        required: true,
        label: t('accounting.form.fields.issueDate', 'Issue date'),
        layout: 'quarter',
      },
      {
        id: 'salesDate',
        type: 'date',
        required: true,
        label: t('accounting.form.fields.salesDate', 'Sales date'),
        layout: 'quarter',
      },
      {
        id: 'paymentTermDays',
        type: 'select',
        required: true,
        label: t('accounting.form.fields.paymentTermDays', 'Payment term'),
        layout: 'quarter',
        options: [
          { value: '7', label: t('accounting.form.paymentTerm.days7', '7 days') },
          { value: '14', label: t('accounting.form.paymentTerm.days14', '14 days') },
          { value: '21', label: t('accounting.form.paymentTerm.days21', '21 days') },
          { value: '30', label: t('accounting.form.paymentTerm.days30', '30 days') },
        ],
      },
      {
        id: 'sellerEntityId',
        type: 'custom',
        label: '',
        layout: 'full',
        component: renderSellerField,
      },
      {
        id: 'buyerEntityId',
        type: 'custom',
        label: '',
        layout: 'full',
        component: InvoiceBuyerField,
      },
      {
        id: 'lineItems',
        type: 'custom',
        label: '',
        component: (props) => <LineItemsEditor {...props} />,
      },
      {
        id: 'paymentMethod',
        type: 'select',
        label: t('accounting.form.fields.paymentMethod', 'Payment method'),
        layout: 'third',
        options: [
          { value: 'cash', label: t('accounting.form.payment.cash', 'Cash') },
          { value: 'transfer', label: t('accounting.form.payment.transfer', 'Transfer') },
          { value: 'card', label: t('accounting.form.payment.card', 'Card') },
        ],
      },
      {
        id: 'currencyCode',
        type: 'text',
        maxLength: 3,
        label: t('accounting.form.fields.currency', 'Currency'),
        layout: 'third',
      },
      {
        id: 'externalReference',
        type: 'text',
        label: t('accounting.form.fields.externalReference', 'External reference'),
        layout: 'third',
      },
      {
        id: 'paymentAccount',
        type: 'custom',
        label: t('accounting.form.fields.paymentAccount', 'Bank account'),
        layout: 'full',
        component: (props) => <PaymentAccountField {...props} sellerBankAccounts={sellerBankAccounts} />,
      },
      { id: 'notes', type: 'textarea', label: t('accounting.form.fields.notes', 'Notes'), layout: 'full' },
    ],
    [renderSellerField, sellerBankAccounts, t],
  )

  const groups = React.useMemo<CrudFormGroup[]>(
    () => [
      {
        id: 'basics',
        column: 1,
        title: t('accounting.form.groups.basics', 'Basics'),
        fields: ['__docNumberSync', 'documentNumber', 'issueDate', 'salesDate', 'paymentTermDays'],
      },
      {
        id: 'line-items',
        column: 1,
        title: t('accounting.form.groups.items', 'Items'),
        fields: ['lineItems'],
      },
      {
        id: 'payment',
        column: 1,
        title: t('accounting.form.groups.paymentDetails', 'Payment details'),
        fields: ['paymentMethod', 'currencyCode', 'externalReference', 'paymentAccount', 'notes'],
      },
      {
        id: 'seller',
        column: 2,
        title: t('accounting.form.groups.seller', 'Seller'),
        fields: ['sellerEntityId'],
      },
      {
        id: 'buyer',
        column: 2,
        title: t('accounting.form.groups.buyer', 'Buyer'),
        fields: ['buyerEntityId'],
      },
    ],
    [t],
  )

  return (
    <Page>
      <PageBody>
        <CrudForm<InvoiceCreateFormValues>
          title={t('accounting.create.title', 'Issue invoice')}
          backHref="/backend/accounting/invoices"
          cancelHref="/backend/accounting/invoices"
          submitLabel={t('accounting.form.actions.create', 'Create invoice')}
          extraActions={
            <IconButton asChild variant="outline" title={t('accounting.create.openSettingsTitle', 'Accounting settings')}>
              <Link
                href="/backend/config/accounting"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('accounting.create.openSettingsTitle', 'Accounting settings')}
              >
                <Settings className="size-4" aria-hidden />
              </Link>
            </IconButton>
          }
          repeatExtraActionsInFooter={false}
          fields={fields}
          groups={groups}
          initialValues={{
            documentNumber: '',
            issueDate: new Date().toISOString().slice(0, 10),
            salesDate: new Date().toISOString().slice(0, 10),
            paymentTermDays: '14',
            sellerEntityId: '',
            sellerName: '',
            sellerNip: '',
            sellerRegon: '',
            sellerAddress: '',
            buyerEntityId: '',
            buyerName: '',
            buyerNip: '',
            buyerRegon: '',
            buyerAddress: '',
            lineItems: [blankLine()],
            paymentMethod: 'transfer',
            paymentAccount: '',
            currencyCode: 'PLN',
            externalReference: '',
            notes: '',
          }}
          onSubmit={async (values) => {
            const paymentTermDays = Number(values.paymentTermDays || '14')
            const paymentDueDate = addDays(values.issueDate, paymentTermDays)
            const lineItems = (Array.isArray(values.lineItems) ? values.lineItems : [])
              .filter((line) => line.name.trim().length > 0)
              .map((line) => ({
                name: line.name.trim(),
                unit: line.unit.trim() || 'szt.',
                quantity: line.quantity.trim() || '0',
                unitPriceNet: line.unitPriceNet.trim() || '0',
                taxRate: line.taxRate.trim() || '0',
              }))
            const totalAmount = sumGross(lineItems).toFixed(2)

            const call = await createCrud<{ id: string }>('accounting/invoices', {
              organizationId,
              tenantId,
              documentKind: 'issued',
              isDraft: false,
              documentNumber: String(values.documentNumber ?? '').trim(),
              issueDate: String(values.issueDate ?? '').trim(),
              salesDate: String(values.salesDate ?? '').trim(),
              paymentTermDays,
              paymentDueDate,
              paymentMethod: values.paymentMethod,
              paymentAccount: String(values.paymentAccount ?? '').trim() || null,
              sellerEntityId: String(values.sellerEntityId ?? '').trim() || null,
              sellerName: String(values.sellerName ?? '').trim() || null,
              sellerNip: String(values.sellerNip ?? '').trim() || null,
              sellerRegon: String(values.sellerRegon ?? '').trim() || null,
              sellerAddress: String(values.sellerAddress ?? '').trim() || null,
              buyerEntityId: String(values.buyerEntityId ?? '').trim() || null,
              buyerName: String(values.buyerName ?? '').trim() || null,
              buyerNip: String(values.buyerNip ?? '').trim() || null,
              buyerRegon: String(values.buyerRegon ?? '').trim() || null,
              buyerAddress: String(values.buyerAddress ?? '').trim() || null,
              counterpartyName: String(values.buyerName ?? '').trim() || null,
              lineItems,
              currencyCode: String(values.currencyCode ?? '').trim().toUpperCase() || null,
              totalAmount,
              externalReference: String(values.externalReference ?? '').trim() || null,
              notes: String(values.notes ?? '').trim() || null,
            })

            const invoiceId = String(call.result?.id ?? '')
            if (!invoiceId) throw new Error(t('accounting.import.form.createFailed', 'Failed to create invoice record.'))
            flash(t('accounting.flash.created', 'Invoice created.'), 'success')
            router.push(`/backend/accounting/invoices/${encodeURIComponent(invoiceId)}`)
          }}
        />
      </PageBody>
    </Page>
  )
}
