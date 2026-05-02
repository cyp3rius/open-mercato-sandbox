'use client'

import * as React from 'react'
import {
  CRUD_FORM_TEXT_INPUT_CLASS,
  CRUD_FORM_TEXTAREA_CLASS,
  type CrudCustomFieldRenderProps,
} from '@open-mercato/ui/backend/CrudForm'
import { EntitySearchCombobox, type EntitySearchComboboxOption } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@open-mercato/ui/primitives/tabs'
import {
  canonicalBankAccountForSelect,
  readSellingEntitySnapshot,
  searchSellingEntities,
  type SellingEntitySnapshot,
} from '../lib/sellingEntitySearch'

type Props = CrudCustomFieldRenderProps & {
  onBankAccountsChange: (accountNumbers: string[]) => void
}

/**
 * Sprzedawca: jak nabywca — zakładka „z listy” (spółki z Ustawień) vs „nowy” (ręcznie).
 * Po wybraniu spółki: pola wypełnione i zablokowane; ręcznie tylko bez wyboru spółki.
 */
export function InvoiceSellerField({ value, setValue, setFormValue, values, disabled, onBankAccountsChange }: Props) {
  const t = useT()
  const [options, setOptions] = React.useState<EntitySearchComboboxOption[]>([])
  const optionsRef = React.useRef(options)
  React.useEffect(() => {
    optionsRef.current = options
  }, [options])
  /** Snapshot po wyborze z listy — podgląd i etykieta comboboxa nie zależą wyłącznie od `values` (batching / memo pól). */
  const [resolvedSeller, setResolvedSeller] = React.useState<SellingEntitySnapshot | null>(null)
  const fetchSeq = React.useRef(0)

  const [activeTab, setActiveTab] = React.useState<'from-entities' | 'new-seller'>('from-entities')

  const selectedId = typeof value === 'string' ? value : ''
  const sellerName = typeof values?.sellerName === 'string' ? values.sellerName : ''
  const sellerNip = typeof values?.sellerNip === 'string' ? values.sellerNip : ''
  const sellerRegon = typeof values?.sellerRegon === 'string' ? values.sellerRegon : ''
  const sellerAddress = typeof values?.sellerAddress === 'string' ? values.sellerAddress : ''

  React.useEffect(() => {
    if (!selectedId.trim()) setResolvedSeller(null)
  }, [selectedId])

  const snapshot = resolvedSeller?.entityId === selectedId ? resolvedSeller : null
  const previewName = (snapshot?.name ?? sellerName).trim()
  const previewNip = snapshot ? snapshot.nip : sellerNip
  const previewRegon = snapshot ? snapshot.regon : sellerRegon
  const previewAddress = snapshot ? snapshot.address : sellerAddress

  const comboboxLabelOverride =
    snapshot?.name.trim() ||
    (selectedId ? (options.find((o) => o.value === selectedId)?.label ?? '').trim() : '')

  const onTabChange = (next: string) => {
    if (next === 'new-seller') {
      fetchSeq.current += 1
      setResolvedSeller(null)
      setValue('')
      onBankAccountsChange([])
      setFormValue?.('paymentAccount', '')
      setActiveTab('new-seller')
      return
    }
    setActiveTab('from-entities')
  }

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <TabsList className="h-9 w-auto max-w-full shrink-0 justify-start gap-0 rounded-lg bg-muted p-1 text-muted-foreground">
          <TabsTrigger value="from-entities" className="px-3">
            {t('accounting.form.seller.tabFromSettings', 'Existing')}
          </TabsTrigger>
          <TabsTrigger value="new-seller" className="px-3">
            {t('accounting.form.seller.tabNew', 'New')}
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="from-entities" className="mt-0 space-y-3">
        <EntitySearchCombobox
          className="w-full"
          value={selectedId}
          selectedDisplayOverride={comboboxLabelOverride}
          onChange={async (next) => {
            setValue(next)
            if (!next) {
              fetchSeq.current += 1
              setResolvedSeller(null)
              onBankAccountsChange([])
              setFormValue?.('paymentAccount', '')
              setFormValue?.('sellerName', '')
              setFormValue?.('sellerNip', '')
              setFormValue?.('sellerRegon', '')
              setFormValue?.('sellerAddress', '')
              return
            }
            const seq = ++fetchSeq.current
            const snap = await readSellingEntitySnapshot(next)
            if (seq !== fetchSeq.current) return
            if (!snap) {
              const opt = optionsRef.current.find((o) => o.value === next)
              const label = opt?.label?.trim() ?? ''
              const fallback: SellingEntitySnapshot = {
                entityId: next,
                name: label || next,
                nip: '',
                regon: '',
                address: '',
                bankAccountNumbers: [],
                suggestedPaymentBankAccount: null,
              }
              setResolvedSeller(fallback)
              onBankAccountsChange([])
              setFormValue?.('paymentAccount', '')
              setFormValue?.('sellerName', fallback.name)
              setFormValue?.('sellerNip', '')
              setFormValue?.('sellerRegon', '')
              setFormValue?.('sellerAddress', '')
              return
            }
            setResolvedSeller(snap)
            setOptions((prev) =>
              prev.some((o) => o.value === snap.entityId) ? prev : [...prev, { value: snap.entityId, label: snap.name }],
            )
            onBankAccountsChange(snap.bankAccountNumbers)
            const pay =
              snap.suggestedPaymentBankAccount &&
              canonicalBankAccountForSelect(snap.suggestedPaymentBankAccount, snap.bankAccountNumbers)
            if (pay) setFormValue?.('paymentAccount', pay)
            else setFormValue?.('paymentAccount', '')
            setFormValue?.('sellerName', snap.name)
            setFormValue?.('sellerNip', snap.nip)
            setFormValue?.('sellerRegon', snap.regon)
            setFormValue?.('sellerAddress', snap.address)
          }}
          options={options}
          onRemoteSearch={async (query) => {
            const rows = await searchSellingEntities(query)
            setOptions(rows)
            return rows
          }}
          disabled={disabled}
          placeholder={t('accounting.form.seller.searchPlaceholder', 'Search selling company...')}
          createInNewTabHref="/backend/config/accounting/entities/create"
          createInNewTabAriaLabel={t('accounting.form.seller.addCompanyInSettings', 'Add selling company in settings')}
        />
        <div
          className={cn(
            'space-y-1.5 rounded-lg border border-border bg-card px-3 py-3 text-sm',
            !previewName && 'text-muted-foreground',
          )}
        >
          <div className="text-sm font-medium text-foreground">
            {previewName || t('accounting.form.seller.previewEmpty', 'No selling company selected')}
          </div>
          {previewNip ? (
            <div className="text-sm text-muted-foreground">
              {t('accounting.form.seller.previewNip', 'NIP')}: {previewNip}
            </div>
          ) : null}
          {previewRegon ? (
            <div className="text-sm text-muted-foreground">
              {t('accounting.form.seller.previewRegon', 'REGON')}: {previewRegon}
            </div>
          ) : null}
          {previewAddress ? <div className="text-sm text-muted-foreground">{previewAddress}</div> : null}
        </div>
      </TabsContent>

      <TabsContent value="new-seller" className="mt-0 space-y-3">
        <p className="text-sm text-muted-foreground">
          {t(
            'accounting.form.seller.newTabHelp',
            'Enter selling party data manually. This invoice will not be linked to a saved selling company.',
          )}
        </p>
        <div className="space-y-2">
          <label className="block text-sm font-medium" htmlFor="inv-seller-name">
            {t('accounting.form.fields.sellerName', 'Name')}
          </label>
          <input
            id="inv-seller-name"
            type="text"
            className={CRUD_FORM_TEXT_INPUT_CLASS}
            value={sellerName}
            disabled={disabled}
            onChange={(e) => {
              setFormValue?.('sellerName', e.target.value)
            }}
            autoComplete="off"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="inv-seller-nip">
              {t('accounting.form.fields.sellerNip', 'NIP')}
            </label>
            <input
              id="inv-seller-nip"
              type="text"
              className={CRUD_FORM_TEXT_INPUT_CLASS}
              value={sellerNip}
              disabled={disabled}
              onChange={(e) => {
                setFormValue?.('sellerNip', e.target.value)
              }}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="inv-seller-regon">
              {t('accounting.form.fields.sellerRegon', 'REGON')}
            </label>
            <input
              id="inv-seller-regon"
              type="text"
              className={CRUD_FORM_TEXT_INPUT_CLASS}
              value={sellerRegon}
              disabled={disabled}
              onChange={(e) => {
                setFormValue?.('sellerRegon', e.target.value)
              }}
              autoComplete="off"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium" htmlFor="inv-seller-addr">
            {t('accounting.form.fields.sellerAddress', 'Address')}
          </label>
          <textarea
            id="inv-seller-addr"
            className={CRUD_FORM_TEXTAREA_CLASS}
            value={sellerAddress}
            disabled={disabled}
            onChange={(e) => {
              setFormValue?.('sellerAddress', e.target.value)
            }}
            rows={3}
          />
        </div>
      </TabsContent>
    </Tabs>
  )
}
