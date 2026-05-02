'use client'

import * as React from 'react'
import { CloudSync, Loader2 } from 'lucide-react'
import {
  CRUD_FORM_TEXT_INPUT_CLASS,
  CRUD_FORM_TEXTAREA_CLASS,
  type CrudCustomFieldRenderProps,
} from '@open-mercato/ui/backend/CrudForm'
import { EntitySearchCombobox, type EntitySearchComboboxOption } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import { readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { createCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { cn } from '@open-mercato/shared/lib/utils'
import { Button } from '@open-mercato/ui/primitives/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@open-mercato/ui/primitives/tabs'
import { isValidNip, normalizeNipDigits } from '@open-mercato/core/modules/customers/lib/nip'
import { isValidRegon, normalizeRegonDigits } from '@open-mercato/core/modules/customers/lib/regon'
import type { MfRegistryCompanyData } from '@open-mercato/core/modules/customers/lib/mfVatRegistry'
import { readCustomerCompanySnapshot, searchCustomerCompanies } from '../lib/customerCompanySearch'

type RegistryLookupResponse = { ok: true; data: MfRegistryCompanyData | null }

/**
 * Buyer block: tab "from CRM" (search) vs "new" (manual + MF sync + save as customer).
 * Inline only — avoids Radix Dialog inside CrudForm (stacking / open state issues).
 */
export function InvoiceBuyerField(props: CrudCustomFieldRenderProps) {
  const t = useT()
  const { value, setValue, setFormValue, values, disabled } = props
  const { organizationId } = useOrganizationScopeDetail()

  const [buyerOptions, setBuyerOptions] = React.useState<EntitySearchComboboxOption[]>([])
  const [activeTab, setActiveTab] = React.useState<'from-crm' | 'new-buyer'>('from-crm')
  const [registryPending, setRegistryPending] = React.useState(false)
  const [registryError, setRegistryError] = React.useState<string | null>(null)
  const [savePending, setSavePending] = React.useState(false)

  const selectedId = typeof value === 'string' ? value : ''
  const buyerName = typeof values?.buyerName === 'string' ? values.buyerName : ''
  const buyerNip = typeof values?.buyerNip === 'string' ? values.buyerNip : ''
  const buyerRegon = typeof values?.buyerRegon === 'string' ? values.buyerRegon : ''
  const buyerAddress = typeof values?.buyerAddress === 'string' ? values.buyerAddress : ''
  const hasNipOrRegon = buyerNip.trim().length > 0 || buyerRegon.trim().length > 0

  const applyRegistryData = React.useCallback(
    (data: MfRegistryCompanyData) => {
      setFormValue?.('buyerName', data.legalName || data.displayName || '')
      setFormValue?.('buyerNip', data.nip || '')
      setFormValue?.('buyerRegon', data.regon || '')
      const addr = [data.addressLine1, data.postalCode, data.city, data.country]
        .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
        .join(', ')
      setFormValue?.('buyerAddress', addr)
    },
    [setFormValue],
  )

  const runRegistryLookup = React.useCallback(async () => {
    const nTrim = buyerNip.trim()
    const rTrim = buyerRegon.trim()
    if (!nTrim && !rTrim) {
      setRegistryError(
        t('customers.companies.form.registrySync.needIdentifier', 'Enter NIP or REGON.'),
      )
      return
    }
    const n = nTrim.length ? normalizeNipDigits(nTrim) : null
    const r = rTrim.length ? normalizeRegonDigits(rTrim) : null
    if (n && (n.length !== 10 || !isValidNip(n))) {
      setRegistryError(t('customers.companies.form.nipInvalid', 'Invalid NIP.'))
      return
    }
    if (r && !isValidRegon(r)) {
      setRegistryError(t('customers.companies.form.regonInvalid', 'Invalid REGON.'))
      return
    }
    setRegistryError(null)
    setRegistryPending(true)
    try {
      const payload: { nip?: string; regon?: string } = {}
      if (n) payload.nip = n
      else if (r) payload.regon = r

      const result = await readApiResultOrThrow<RegistryLookupResponse>(
        '/api/customers/companies/registry-lookup',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        },
        {
          errorMessage: t(
            'customers.companies.form.registrySync.requestError',
            'Could not fetch data from the registry.',
          ),
        },
      )
      if (!result.data) {
        setRegistryError(
          t(
            'customers.companies.form.registrySync.notFound',
            'No company found for this identifier in the VAT whitelist.',
          ),
        )
        return
      }
      applyRegistryData(result.data)
    } catch (err) {
      setRegistryError(err instanceof Error ? err.message : String(err))
    } finally {
      setRegistryPending(false)
    }
  }, [applyRegistryData, buyerNip, buyerRegon, t])

  const onTabChange = (next: string) => {
    if (next === 'new-buyer') {
      setValue('')
      setActiveTab('new-buyer')
      return
    }
    setActiveTab('from-crm')
  }

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <TabsList className="h-9 w-auto max-w-full shrink-0 justify-start gap-0 rounded-lg bg-muted p-1 text-muted-foreground">
          <TabsTrigger value="from-crm" className="px-3">
            {t('accounting.form.buyer.tabFromCrm', 'Existing')}
          </TabsTrigger>
          <TabsTrigger value="new-buyer" className="px-3">
            {t('accounting.form.buyer.tabNew', 'New')}
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="from-crm" className="mt-0 space-y-3">
        <EntitySearchCombobox
          className="w-full"
          value={selectedId}
          onChange={async (next) => {
            setValue(next)
            if (!next) return
            const snapshot = await readCustomerCompanySnapshot(next)
            if (!snapshot) return
            setFormValue?.('buyerName', snapshot.name)
            setFormValue?.('buyerNip', snapshot.nip)
            setFormValue?.('buyerRegon', snapshot.regon)
            setFormValue?.('buyerAddress', snapshot.address)
          }}
          options={buyerOptions}
          onRemoteSearch={async (query) => {
            const rows = await searchCustomerCompanies(query)
            setBuyerOptions(rows)
            return rows
          }}
          disabled={disabled}
          placeholder={t('accounting.form.buyer.searchPlaceholder', 'Search for a client...')}
          createInNewTabHref="/backend/customers/companies/create"
          createInNewTabAriaLabel={t('accounting.form.buyer.createCompany', 'Create buyer company')}
        />
        <div
          className={cn(
            'space-y-1.5 rounded-lg border border-border bg-card px-3 py-3 text-sm',
            !buyerName.trim() && 'text-muted-foreground',
          )}
        >
          <div className="text-sm font-medium text-foreground">
            {buyerName || t('accounting.form.buyer.previewEmpty', 'No buyer selected')}
          </div>
          {buyerNip ? (
            <div className="text-sm text-muted-foreground">
              {t('accounting.form.buyer.previewNip', 'NIP')}: {buyerNip}
            </div>
          ) : null}
          {buyerRegon ? (
            <div className="text-sm text-muted-foreground">
              {t('accounting.form.buyer.previewRegon', 'REGON')}: {buyerRegon}
            </div>
          ) : null}
          {buyerAddress ? <div className="text-sm text-muted-foreground">{buyerAddress}</div> : null}
        </div>
      </TabsContent>

      <TabsContent value="new-buyer" className="mt-0 space-y-3">
        <p className="text-sm text-muted-foreground">
          {t(
            'accounting.form.buyer.newTabHelp',
            'Enter data manually, or fetch the company from the MF database by NIP or REGON.',
          )}
        </p>
        <div className="space-y-2">
          <label className="block text-sm font-medium" htmlFor="inv-buyer-name">
            {t('accounting.form.fields.buyerName', 'Name')}
          </label>
          <input
            id="inv-buyer-name"
            type="text"
            className={CRUD_FORM_TEXT_INPUT_CLASS}
            value={buyerName}
            disabled={disabled}
            onChange={(e) => setFormValue?.('buyerName', e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="inv-buyer-nip">
              {t('accounting.form.fields.buyerNip', 'NIP')}
            </label>
            <input
              id="inv-buyer-nip"
              type="text"
              className={CRUD_FORM_TEXT_INPUT_CLASS}
              value={buyerNip}
              disabled={disabled}
              onChange={(e) => {
                setRegistryError(null)
                setFormValue?.('buyerNip', e.target.value)
              }}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="inv-buyer-regon">
              {t('accounting.form.fields.buyerRegon', 'REGON')}
            </label>
            <input
              id="inv-buyer-regon"
              type="text"
              className={CRUD_FORM_TEXT_INPUT_CLASS}
              value={buyerRegon}
              disabled={disabled}
              onChange={(e) => {
                setRegistryError(null)
                setFormValue?.('buyerRegon', e.target.value)
              }}
              autoComplete="off"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={disabled || registryPending || !hasNipOrRegon}
            onClick={() => void runRegistryLookup()}
          >
            {registryPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CloudSync className="mr-2 h-4 w-4" />}
            {t('accounting.form.buyer.syncData', 'Synchronize data')}
          </Button>
        </div>
        {registryError ? <p className="text-sm text-destructive">{registryError}</p> : null}
        <div className="space-y-2">
          <label className="block text-sm font-medium" htmlFor="inv-buyer-addr">
            {t('accounting.form.fields.buyerAddress', 'Address')}
          </label>
          <textarea
            id="inv-buyer-addr"
            className={CRUD_FORM_TEXTAREA_CLASS}
            value={buyerAddress}
            disabled={disabled}
            onChange={(e) => setFormValue?.('buyerAddress', e.target.value)}
            rows={3}
          />
        </div>
        <div>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || !buyerName.trim() || savePending}
            onClick={async () => {
              setSavePending(true)
              try {
                const payload: Record<string, unknown> = {
                  displayName: buyerName.trim(),
                  legalName: buyerName.trim(),
                  organizationId,
                  nip: buyerNip.trim() || undefined,
                  regon: buyerRegon.trim() || undefined,
                }
                const call = await createCrud<{ id?: string }>('customers/companies', payload)
                const newId = typeof call.result?.id === 'string' ? call.result.id : ''
                if (newId) {
                  setValue(newId)
                  setActiveTab('from-crm')
                  flash(t('accounting.form.buyer.savedAsCustomer', 'Buyer saved as customer.'), 'success')
                }
              } finally {
                setSavePending(false)
              }
            }}
          >
            {savePending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('accounting.form.buyer.saveAsCustomer', 'Save buyer as customer')}
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  )
}
