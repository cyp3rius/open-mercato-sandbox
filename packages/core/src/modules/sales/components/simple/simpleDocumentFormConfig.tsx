"use client"

import * as React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  CRUD_FORM_TEXT_INPUT_CLASS,
  type CrudField,
  type CrudFormGroup,
} from '@open-mercato/ui/backend/CrudForm'
import { EntitySearchCombobox } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import {
  mergeEntitySearchOption,
  remoteSearchAuthUsers,
  remoteSearchCustomerEntities,
} from '@open-mercato/core/modules/procurement/lib/procurementEntitySearch'
import {
  DictionaryEntrySelect,
  type DictionaryOption,
  type DictionarySelectLabels,
} from '@open-mercato/core/modules/dictionaries/components/DictionaryEntrySelect'
import { useCurrencyDictionary } from '@open-mercato/core/modules/customers/components/detail/hooks/useCurrencyDictionary'
import { CATALOG_SUBSCRIPTION_SERVICE_LINE_CODE } from '@open-mercato/core/modules/catalog/data/types'
import { DocumentTotals } from '../documents/DocumentTotals'
import { PriceWithCurrency } from '../PriceWithCurrency'
import type { SimpleDocumentKind } from './SimpleDocumentsTable'
import {
  resolveReferringPartnerFromDealApi,
  resolveReferringPartnerFromQuoteDoc,
} from './referringPartnerPrefill'
import { ReferringPartnerProgramField } from './ReferringPartnerProgramField'

export type SimpleDocumentLineDraft = {
  key: string
  id?: string
  productId: string
  productLabel: string
  serviceLineCode: string | null
  quantity: string
  unitPriceNet: string
  taxRate: string
  unitPriceGross: string
  subscriptionStartsAt: string
  subscriptionEndsAt: string
}

export type SimpleDocumentFormValues = {
  customerEntityId: string
  customerLabel: string
  ownerUserId: string
  ownerLabel: string
  referringPartnerEntityId: string
  referringPartnerLabel: string
  referringPartnerProgramId: string
  statusEntryId: string
  currencyCode: string
  documentDate: string
  documentNumber: string
  lines: SimpleDocumentLineDraft[]
}

export function isSubscriptionLine(code: string | null | undefined): boolean {
  return typeof code === 'string' && code.trim().toLowerCase() === CATALOG_SUBSCRIPTION_SERVICE_LINE_CODE
}

export function emptySimpleDocumentLine(): SimpleDocumentLineDraft {
  return {
    key: crypto.randomUUID(),
    productId: '',
    productLabel: '',
    serviceLineCode: null,
    quantity: '1',
    unitPriceNet: '',
    taxRate: '23',
    unitPriceGross: '',
    subscriptionStartsAt: '',
    subscriptionEndsAt: '',
  }
}

export function defaultSimpleDocumentValues(): SimpleDocumentFormValues {
  return {
    customerEntityId: '',
    customerLabel: '',
    ownerUserId: '',
    ownerLabel: '',
    referringPartnerEntityId: '',
    referringPartnerLabel: '',
    referringPartnerProgramId: '',
    statusEntryId: '',
    currencyCode: 'PLN',
    documentDate: new Date().toISOString().slice(0, 10),
    documentNumber: '',
    lines: [emptySimpleDocumentLine()],
  }
}

const PRODUCT_ID_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isSimpleDocumentProductPrefillId(value: string | null | undefined): boolean {
  return typeof value === 'string' && PRODUCT_ID_UUID_RE.test(value.trim())
}

export function lineDraftFromCatalogProduct(
  item: Record<string, unknown>,
): SimpleDocumentLineDraft | null {
  const id = typeof item.id === 'string' ? item.id : null
  if (!id) return null
  const label =
    (typeof item.title === 'string' && item.title.trim()) ||
    (typeof item.name === 'string' && item.name.trim()) ||
    id
  const serviceLineCode =
    typeof item.service_line_code === 'string'
      ? item.service_line_code
      : typeof item.serviceLineCode === 'string'
        ? item.serviceLineCode
        : null
  return {
    ...emptySimpleDocumentLine(),
    productId: id,
    productLabel: label,
    serviceLineCode,
  }
}

export async function fetchSimpleDocumentPrefillValues(
  productId: string,
): Promise<SimpleDocumentFormValues | null> {
  const params = new URLSearchParams({
    id: productId.trim(),
    page: '1',
    pageSize: '1',
  })
  const call = await apiCall<{ items?: Array<Record<string, unknown>> }>(
    `/api/catalog/products?${params.toString()}`,
  )
  if (!call.ok) return null
  const items = Array.isArray(call.result?.items) ? call.result.items : []
  const product = items[0]
  if (!product) return null
  const line = lineDraftFromCatalogProduct(product)
  if (!line) return null
  return {
    ...defaultSimpleDocumentValues(),
    lines: [line],
  }
}

function isoToDateInput(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return ''
  return value.slice(0, 10)
}

function readApiString(item: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = item[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function readApiScalar(item: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (item[key] != null && item[key] !== '') return item[key]
  }
  return undefined
}

function productLabelFromLineItem(item: Record<string, unknown>, productId: string): string {
  const direct = readApiString(item, 'productTitle', 'product_title', 'title', 'name')
  if (direct && direct !== productId) return direct
  const snapshot =
    item.catalogSnapshot && typeof item.catalogSnapshot === 'object'
      ? (item.catalogSnapshot as Record<string, unknown>)
      : item.catalog_snapshot && typeof item.catalog_snapshot === 'object'
        ? (item.catalog_snapshot as Record<string, unknown>)
        : null
  const product =
    snapshot?.product && typeof snapshot.product === 'object'
      ? (snapshot.product as Record<string, unknown>)
      : snapshot
  const fromSnapshot = readApiString(product ?? {}, 'title', 'name', 'displayName')
  if (fromSnapshot && fromSnapshot !== productId) return fromSnapshot
  return direct || productId
}

function serviceLineCodeFromLineItem(item: Record<string, unknown>): string | null {
  const direct = readApiString(item, 'serviceLineCode', 'service_line_code')
  if (direct) return direct
  const snapshot =
    item.catalogSnapshot && typeof item.catalogSnapshot === 'object'
      ? (item.catalogSnapshot as Record<string, unknown>)
      : item.catalog_snapshot && typeof item.catalog_snapshot === 'object'
        ? (item.catalog_snapshot as Record<string, unknown>)
        : null
  const product =
    snapshot?.product && typeof snapshot.product === 'object'
      ? (snapshot.product as Record<string, unknown>)
      : null
  const fromSnapshot = readApiString(product ?? {}, 'serviceLineCode', 'service_line_code')
  return fromSnapshot || null
}

/** Map quote/order line API row (camelCase or snake_case) to the simple editor draft. */
export function mapSalesLineApiItemToDraft(
  item: Record<string, unknown>,
  options?: { keepId?: boolean },
): SimpleDocumentLineDraft {
  const productId = readApiString(item, 'productId', 'product_id')
  const id = readApiString(item, 'id')
  return {
    key: options?.keepId && id ? id : crypto.randomUUID(),
    ...(options?.keepId && id ? { id } : {}),
    productId,
    productLabel: productLabelFromLineItem(item, productId),
    serviceLineCode: serviceLineCodeFromLineItem(item),
    quantity: String(readApiScalar(item, 'quantity') ?? '1'),
    unitPriceNet: (() => {
      const value = readApiScalar(item, 'unitPriceNet', 'unit_price_net')
      return value != null ? String(value) : ''
    })(),
    taxRate: (() => {
      const value = readApiScalar(item, 'taxRate', 'tax_rate')
      return value != null ? String(value) : '23'
    })(),
    unitPriceGross: (() => {
      const value = readApiScalar(item, 'unitPriceGross', 'unit_price_gross')
      return value != null ? String(value) : ''
    })(),
    subscriptionStartsAt: isoToDateInput(
      readApiScalar(item, 'subscriptionStartsAt', 'subscription_starts_at'),
    ),
    subscriptionEndsAt: isoToDateInput(
      readApiScalar(item, 'subscriptionEndsAt', 'subscription_ends_at'),
    ),
  }
}

function productMetaFromCatalogItem(item: Record<string, unknown>): {
  label: string
  serviceLineCode: string | null
} | null {
  const id = typeof item.id === 'string' ? item.id : null
  if (!id) return null
  const label =
    (typeof item.title === 'string' && item.title.trim()) ||
    (typeof item.name === 'string' && item.name.trim()) ||
    id
  const serviceLineCode =
    typeof item.service_line_code === 'string'
      ? item.service_line_code
      : typeof item.serviceLineCode === 'string'
        ? item.serviceLineCode
        : null
  return { label, serviceLineCode }
}

/** Resolve product titles (and service line codes) from catalog when line API rows only have product ids. */
export async function hydrateSimpleDocumentLineProductLabels(
  lines: SimpleDocumentLineDraft[],
): Promise<SimpleDocumentLineDraft[]> {
  const ids = [...new Set(lines.map((line) => line.productId.trim()).filter(Boolean))]
  if (!ids.length) return lines

  const params = new URLSearchParams({
    ids: ids.join(','),
    page: '1',
    pageSize: String(Math.min(100, Math.max(ids.length, 1))),
  })
  const call = await apiCall<{ items?: Array<Record<string, unknown>> }>(
    `/api/catalog/products?${params.toString()}`,
  )
  if (!call.ok) return lines
  const items = Array.isArray(call.result?.items) ? call.result.items : []
  const byId = new Map<string, { label: string; serviceLineCode: string | null }>()
  for (const item of items) {
    const id = typeof item.id === 'string' ? item.id : null
    if (!id) continue
    const meta = productMetaFromCatalogItem(item)
    if (meta) byId.set(id, meta)
  }
  if (!byId.size) return lines

  return lines.map((line) => {
    const meta = byId.get(line.productId.trim())
    if (!meta) return line
    const label = line.productLabel.trim()
    const needsLabel = !label || label === line.productId.trim()
    return {
      ...line,
      productLabel: needsLabel ? meta.label : line.productLabel,
      serviceLineCode: line.serviceLineCode ?? meta.serviceLineCode,
    }
  })
}

function firstDocItem(result: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!result) return null
  if (Array.isArray(result.items) && result.items[0] && typeof result.items[0] === 'object') {
    return result.items[0] as Record<string, unknown>
  }
  if ('id' in result && typeof result.id === 'string') return result
  return null
}

/** Prefill quote create from an existing deal (header only — no lines). */
export async function fetchSimpleQuotePrefillFromDeal(
  dealId: string,
): Promise<{ values: SimpleDocumentFormValues; dealTitle: string } | null> {
  const id = dealId.trim()
  if (!id) return null
  const call = await apiCall<{
    deal?: {
      id?: string
      title?: string | null
      valueCurrency?: string | null
      ownerUserId?: string | null
      referringPartnerEntityId?: string | null
    }
    people?: Array<{ id?: string }>
    companies?: Array<{ id?: string }>
    referringPartner?: { id?: string; label?: string } | null
  }>(`/api/customers/deals/${encodeURIComponent(id)}`)
  if (!call.ok || !call.result?.deal) return null

  const deal = call.result.deal
  const companyId =
    (call.result.companies ?? [])
      .map((entry) => (typeof entry.id === 'string' ? entry.id.trim() : ''))
      .find((value) => value.length > 0) ?? ''
  const personId =
    (call.result.people ?? [])
      .map((entry) => (typeof entry.id === 'string' ? entry.id.trim() : ''))
      .find((value) => value.length > 0) ?? ''
  const customerEntityId = companyId || personId
  const currencyRaw =
    typeof deal.valueCurrency === 'string' ? deal.valueCurrency.trim().toUpperCase() : ''
  const currencyCode = /^[A-Z]{3}$/.test(currencyRaw)
    ? currencyRaw
    : defaultSimpleDocumentValues().currencyCode
  const ownerUserId = typeof deal.ownerUserId === 'string' ? deal.ownerUserId : ''
  const { referringPartnerEntityId, referringPartnerLabel } = resolveReferringPartnerFromDealApi(
    call.result,
  )
  const dealTitle = typeof deal.title === 'string' ? deal.title.trim() : ''

  return {
    dealTitle,
    values: {
      ...defaultSimpleDocumentValues(),
      customerEntityId,
      customerLabel: '',
      ownerUserId,
      ownerLabel: '',
      referringPartnerEntityId,
      referringPartnerLabel,
      currencyCode,
      documentDate: new Date().toISOString().slice(0, 10),
      documentNumber: '',
      statusEntryId: '',
      lines: defaultSimpleDocumentValues().lines,
    },
  }
}

/** Prefill order create from an existing quote (header + lines without line ids). */
export async function fetchSimpleOrderPrefillFromQuote(
  quoteId: string,
): Promise<{ values: SimpleDocumentFormValues; quoteNumber: string } | null> {
  const id = quoteId.trim()
  if (!id) return null
  const docCall = await apiCall<Record<string, unknown>>(`/api/sales/quotes?id=${encodeURIComponent(id)}`)
  if (!docCall.ok) return null
  const doc = firstDocItem(docCall.result)
  if (!doc) return null

  const snapshot =
    doc.customerSnapshot && typeof doc.customerSnapshot === 'object'
      ? (doc.customerSnapshot as Record<string, unknown>)
      : null
  const customer = snapshot?.customer as Record<string, unknown> | undefined
  const customerEntityId = typeof doc.customerEntityId === 'string' ? doc.customerEntityId : ''
  const customerLabel =
    typeof customer?.displayName === 'string' && customer.displayName.trim()
      ? customer.displayName.trim()
      : ''

  const linesCall = await apiCall<{ items?: Array<Record<string, unknown>> }>(
    `/api/sales/quote-lines?quoteId=${encodeURIComponent(id)}&page=1&pageSize=100`,
  )
  const lineItems = Array.isArray(linesCall.result?.items) ? linesCall.result.items : []
  const mappedLines: SimpleDocumentLineDraft[] = lineItems.length
    ? lineItems.map((item) => mapSalesLineApiItemToDraft(item))
    : defaultSimpleDocumentValues().lines
  const lines = await hydrateSimpleDocumentLineProductLabels(mappedLines)

  const quoteNumber = typeof doc.quoteNumber === 'string' ? doc.quoteNumber : ''
  const referringPartnerEntityId = resolveReferringPartnerFromQuoteDoc(doc)
  return {
    quoteNumber,
    values: {
      ...defaultSimpleDocumentValues(),
      customerEntityId,
      customerLabel,
      ownerUserId: typeof doc.ownerUserId === 'string' ? doc.ownerUserId : '',
      ownerLabel: '',
      referringPartnerEntityId,
      referringPartnerLabel: '',
      referringPartnerProgramId:
        typeof doc.referringPartnerProgramId === 'string' ? doc.referringPartnerProgramId : '',
      currencyCode: typeof doc.currencyCode === 'string' ? doc.currencyCode : defaultSimpleDocumentValues().currencyCode,
      documentDate: isoToDateInput(doc.validFrom) || new Date().toISOString().slice(0, 10),
      documentNumber: '',
      statusEntryId: '',
      lines,
    },
  }
}

async function remoteSearchProducts(query: string): Promise<
  Array<{ value: string; label: string; serviceLineCode: string | null }>
> {
  const params = new URLSearchParams({ page: '1', pageSize: '20' })
  if (query.trim()) params.set('search', query.trim())
  const call = await apiCall<{ items?: Array<Record<string, unknown>> }>(`/api/catalog/products?${params}`)
  const items = Array.isArray(call.result?.items) ? call.result.items : []
  return items
    .map((item) => {
      const id = typeof item.id === 'string' ? item.id : null
      if (!id) return null
      const label =
        (typeof item.title === 'string' && item.title) ||
        (typeof item.name === 'string' && item.name) ||
        id
      const serviceLineCode =
        typeof item.service_line_code === 'string'
          ? item.service_line_code
          : typeof item.serviceLineCode === 'string'
            ? item.serviceLineCode
            : null
      return { value: id, label, serviceLineCode }
    })
    .filter((entry): entry is { value: string; label: string; serviceLineCode: string | null } => !!entry)
}

function partnerListQueryString(search?: string): string {
  const params = new URLSearchParams({
    page: '1',
    pageSize: '50',
    crmRecordTypes: 'partner,referrer',
  })
  const q = typeof search === 'string' ? search.trim() : ''
  if (q.length) params.set('search', q)
  return params.toString()
}

function pickPartnerDisplayName(row: Record<string, unknown>): string {
  const dn = row.display_name ?? row.displayName
  if (typeof dn === 'string' && dn.trim().length) return dn.trim()
  const pe = row.primary_email ?? row.primaryEmail
  if (typeof pe === 'string' && pe.trim().length) return pe.trim()
  return typeof row.id === 'string' ? row.id : ''
}

async function remoteSearchReferringPartners(
  query: string,
  parts: { personPrefix: string; companyPrefix: string },
): Promise<Array<{ value: string; label: string }>> {
  const qs = partnerListQueryString(query)
  const [peopleCall, companiesCall] = await Promise.all([
    apiCall<{ items?: Array<Record<string, unknown>> }>(`/api/customers/people?${qs}`),
    apiCall<{ items?: Array<Record<string, unknown>> }>(`/api/customers/companies?${qs}`),
  ])
  const out: Array<{ value: string; label: string }> = []
  if (peopleCall.ok && Array.isArray(peopleCall.result?.items)) {
    for (const row of peopleCall.result.items) {
      const id = typeof row.id === 'string' ? row.id : ''
      if (!id.length) continue
      const label = pickPartnerDisplayName(row)
      out.push({
        value: id,
        label: `${parts.personPrefix}: ${label.length ? label : id}`,
      })
    }
  }
  if (companiesCall.ok && Array.isArray(companiesCall.result?.items)) {
    for (const row of companiesCall.result.items) {
      const id = typeof row.id === 'string' ? row.id : ''
      if (!id.length) continue
      const label = pickPartnerDisplayName(row)
      out.push({
        value: id,
        label: `${parts.companyPrefix}: ${label.length ? label : id}`,
      })
    }
  }
  out.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  return out
}

function lineAmounts(line: SimpleDocumentLineDraft): { net: number; gross: number; tax: number } {
  const qty = Number(line.quantity)
  const netUnit = Number(line.unitPriceNet)
  const taxRate = Number(line.taxRate)
  const safeQty = Number.isFinite(qty) ? qty : 0
  const safeNet = Number.isFinite(netUnit) ? netUnit : 0
  const safeTax = Number.isFinite(taxRate) ? taxRate : 0
  const grossUnit =
    line.unitPriceGross.trim().length > 0 && Number.isFinite(Number(line.unitPriceGross))
      ? Number(line.unitPriceGross)
      : safeNet * (1 + safeTax / 100)
  const net = safeQty * safeNet
  const gross = safeQty * grossUnit
  return { net, gross, tax: gross - net }
}

function SimpleDocumentCurrencyField({
  value,
  setValue,
  disabled,
  i18nPrefix,
  t,
}: {
  value: unknown
  setValue: (next: string) => void
  disabled?: boolean
  i18nPrefix: string
  t: (key: string, fallback?: string) => string
}) {
  const { data: currencyDictionary, refetch: refetchCurrencyDictionary } = useCurrencyDictionary()
  const labels = React.useMemo<DictionarySelectLabels>(
    () => ({
      placeholder: t(`${i18nPrefix}.fields.currencyPlaceholder`, 'Select currency'),
      addLabel: t(`${i18nPrefix}.fields.currencyAdd`, 'Add currency'),
      addPrompt: t(`${i18nPrefix}.fields.currencyPrompt`, 'Currency code'),
      dialogTitle: t(`${i18nPrefix}.fields.currencyDialogTitle`, 'Add currency'),
      valueLabel: t(`${i18nPrefix}.fields.currencyValueLabel`, 'Currency code'),
      valuePlaceholder: t(`${i18nPrefix}.fields.currencyValuePlaceholder`, 'e.g. PLN'),
      labelLabel: t(`${i18nPrefix}.fields.currencyLabelLabel`, 'Label'),
      labelPlaceholder: t(`${i18nPrefix}.fields.currencyLabelPlaceholder`, 'Display name'),
      emptyError: t(`${i18nPrefix}.fields.currencyEmptyError`, 'Currency code is required'),
      cancelLabel: t(`${i18nPrefix}.fields.currencyCancel`, 'Cancel'),
      saveLabel: t(`${i18nPrefix}.fields.currencySave`, 'Save'),
      successCreateLabel: t(`${i18nPrefix}.fields.currencyCreated`, 'Currency saved.'),
      errorLoad: t(`${i18nPrefix}.fields.currencyErrorLoad`, 'Failed to load currencies.'),
      errorSave: t(`${i18nPrefix}.fields.currencyErrorSave`, 'Failed to save currency.'),
      loadingLabel: t(`${i18nPrefix}.fields.currencyLoading`, 'Loading currencies…'),
      manageTitle: t(`${i18nPrefix}.fields.currencyManage`, 'Manage currency dictionary'),
    }),
    [i18nPrefix, t],
  )
  const fetchOptions = React.useCallback(async (): Promise<DictionaryOption[]> => {
    try {
      const source = currencyDictionary ?? (await refetchCurrencyDictionary())
      if (source && Array.isArray(source.entries)) {
        return source.entries.map((entry) => ({
          value: entry.value,
          label: entry.label,
          color: entry.color ?? null,
          icon: entry.icon ?? null,
        }))
      }
      return []
    } catch {
      return []
    }
  }, [currencyDictionary, refetchCurrencyDictionary])

  return (
    <DictionaryEntrySelect
      value={typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : undefined}
      onChange={(next) => setValue(next ? next.toUpperCase() : '')}
      fetchOptions={fetchOptions}
      allowInlineCreate={false}
      allowAppearance
      manageHref="/backend/config/dictionaries?key=currency"
      selectClassName="w-full"
      labels={labels}
      disabled={disabled}
    />
  )
}

function SimpleDocumentStatusField({
  value,
  setValue,
  disabled,
  kind,
  i18nPrefix,
  t,
}: {
  value: unknown
  setValue: (next: string) => void
  disabled?: boolean
  kind: SimpleDocumentKind
  i18nPrefix: string
  t: (key: string, fallback?: string) => string
}) {
  const labels = React.useMemo<DictionarySelectLabels>(
    () => ({
      placeholder: t(`${i18nPrefix}.fields.statusPlaceholder`, 'Select status'),
      addLabel: t(`${i18nPrefix}.fields.statusAdd`, 'Add status'),
      addPrompt: t(`${i18nPrefix}.fields.statusPrompt`, 'Status value'),
      dialogTitle: t(`${i18nPrefix}.fields.statusDialogTitle`, 'Add status'),
      valueLabel: t(`${i18nPrefix}.fields.statusValueLabel`, 'Status value'),
      valuePlaceholder: t(`${i18nPrefix}.fields.statusValuePlaceholder`, 'e.g. confirmed'),
      labelLabel: t(`${i18nPrefix}.fields.statusLabelLabel`, 'Label'),
      labelPlaceholder: t(`${i18nPrefix}.fields.statusLabelPlaceholder`, 'Display name'),
      emptyError: t(`${i18nPrefix}.fields.statusEmptyError`, 'Status is required'),
      cancelLabel: t(`${i18nPrefix}.fields.statusCancel`, 'Cancel'),
      saveLabel: t(`${i18nPrefix}.fields.statusSave`, 'Save'),
      successCreateLabel: t(`${i18nPrefix}.fields.statusCreated`, 'Status saved.'),
      errorLoad: t(`${i18nPrefix}.fields.statusErrorLoad`, 'Failed to load statuses.'),
      errorSave: t(`${i18nPrefix}.fields.statusErrorSave`, 'Failed to save status.'),
      loadingLabel: t(`${i18nPrefix}.fields.statusLoading`, 'Loading statuses…'),
      manageTitle: t(`${i18nPrefix}.fields.statusManage`, 'Manage sales statuses'),
    }),
    [i18nPrefix, t],
  )

  const fetchOptions = React.useCallback(async (): Promise<DictionaryOption[]> => {
    const path =
      kind === 'order'
        ? '/api/sales/order-statuses?page=1&pageSize=100'
        : '/api/sales/quote-statuses?page=1&pageSize=100'
    const call = await apiCall<{ items?: Array<Record<string, unknown>> }>(path, undefined, {
      fallback: { items: [] },
    })
    const items = Array.isArray(call.result?.items) ? call.result.items : []
    return items
      .map((item) => {
        const id = typeof item.id === 'string' ? item.id : ''
        if (!id) return null
        const statusValue = typeof item.value === 'string' ? item.value : ''
        const label = typeof item.label === 'string' && item.label.trim() ? item.label : statusValue || id
        const color = typeof item.color === 'string' ? item.color : null
        const icon = typeof item.icon === 'string' ? item.icon : null
        return { value: id, label, color, icon }
      })
      .filter((entry): entry is DictionaryOption => !!entry)
  }, [kind])

  return (
    <DictionaryEntrySelect
      value={typeof value === 'string' && value.trim() ? value : undefined}
      onChange={(next) => setValue(next ?? '')}
      fetchOptions={fetchOptions}
      allowInlineCreate={false}
      allowAppearance
      manageHref="/backend/config/sales"
      selectClassName="w-full"
      labels={labels}
      disabled={disabled}
    />
  )
}

function SimpleDocumentCustomerField({
  value,
  setValue,
  setFormValue,
  disabled,
  customerLabel,
  i18nPrefix,
  t,
}: {
  value: unknown
  setValue: (next: string) => void
  setFormValue?: (id: string, value: unknown) => void
  disabled?: boolean
  customerLabel?: string
  i18nPrefix: string
  t: (key: string, fallback?: string) => string
}) {
  const str = typeof value === 'string' ? value : ''
  const label = typeof customerLabel === 'string' && customerLabel.trim() ? customerLabel : str
  const labelByIdRef = React.useRef<Map<string, string>>(new Map())
  if (str && label) labelByIdRef.current.set(str, label)
  return (
    <EntitySearchCombobox
      value={str}
      onChange={(next) => {
        setValue(next)
        if (typeof setFormValue === 'function') {
          setFormValue('customerLabel', labelByIdRef.current.get(next) ?? next)
        }
      }}
      options={mergeEntitySearchOption([], str, label)}
      onRemoteSearch={async (q) => {
        const rows = await remoteSearchCustomerEntities(q)
        for (const row of rows) labelByIdRef.current.set(row.value, row.label)
        return mergeEntitySearchOption(rows, str, label)
      }}
      placeholder={t(`${i18nPrefix}.fields.customerSearch`, 'Search customers…')}
      disabled={disabled}
      createInNewTabHref="/backend/customers/companies/create"
      createInNewTabAriaLabel={t(
        `${i18nPrefix}.fields.customerCreateTab`,
        'Open new company form in a new tab',
      )}
    />
  )
}

function SimpleDocumentLinesTable({
  value,
  setValue,
  disabled,
  currencyCode,
  i18nPrefix,
  t,
}: {
  value: unknown
  setValue: (next: SimpleDocumentLineDraft[]) => void
  disabled?: boolean
  currencyCode: string
  i18nPrefix: string
  t: (key: string, fallback?: string) => string
}) {
  const lines = Array.isArray(value) && value.length
    ? (value as SimpleDocumentLineDraft[])
    : [emptySimpleDocumentLine()]
  const productMetaRef = React.useRef<Map<string, { label: string; serviceLineCode: string | null }>>(new Map())

  const updateLine = (key: string, patch: Partial<SimpleDocumentLineDraft>) => {
    setValue(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  const totals = React.useMemo(() => {
    return lines.reduce(
      (acc, line) => {
        const amounts = lineAmounts(line)
        acc.net += amounts.net
        acc.tax += amounts.tax
        acc.gross += amounts.gross
        return acc
      },
      { net: 0, tax: 0, gross: 0 },
    )
  }, [lines])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">
          {t(`${i18nPrefix}.lines.title`, 'Items')}
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="inline-flex items-center gap-2"
          onClick={() => setValue([...lines, emptySimpleDocumentLine()])}
        >
          <Plus className="size-4 shrink-0" aria-hidden />
          {t(`${i18nPrefix}.lines.add`, 'Add item')}
        </Button>
      </div>
      <div className="overflow-x-auto rounded border">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[10%]" />
            <col className="w-[15%]" />
            <col className="w-[10%]" />
            <col className="w-[15%]" />
            <col className="w-[18%]" />
            <col className="w-[8%]" />
          </colgroup>
          <thead className="bg-muted">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">{t(`${i18nPrefix}.lines.product`, 'Product')}</th>
              <th className="px-3 py-2 font-medium">{t(`${i18nPrefix}.lines.quantity`, 'Qty')}</th>
              <th className="px-3 py-2 font-medium">{t(`${i18nPrefix}.lines.unitPriceNet`, 'Net')}</th>
              <th className="px-3 py-2 font-medium">{t(`${i18nPrefix}.lines.taxRate`, 'Tax %')}</th>
              <th className="px-3 py-2 font-medium">{t(`${i18nPrefix}.lines.unitPriceGross`, 'Gross')}</th>
              <th className="px-3 py-2 font-medium text-right">{t(`${i18nPrefix}.lines.lineTotal`, 'Total')}</th>
              <th className="px-3 py-2 font-medium sr-only">{t(`${i18nPrefix}.lines.actions`, 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <SimpleDocumentLineRow
                key={line.key}
                line={line}
                disabled={disabled}
                currencyCode={currencyCode}
                i18nPrefix={i18nPrefix}
                t={t}
                canRemove={lines.length > 1}
                productMetaRef={productMetaRef}
                onUpdate={(patch) => updateLine(line.key, patch)}
                onRemove={() => setValue(lines.filter((entry) => entry.key !== line.key))}
              />
            ))}
          </tbody>
        </table>
      </div>
      <DocumentTotals
        currency={currencyCode}
        items={[
          {
            key: 'net',
            label: t(`${i18nPrefix}.totals.net`, 'Net total'),
            amount: totals.net,
          },
          {
            key: 'tax',
            label: t(`${i18nPrefix}.totals.tax`, 'Tax'),
            amount: totals.tax,
          },
          {
            key: 'gross',
            label: t(`${i18nPrefix}.totals.gross`, 'Gross total'),
            amount: totals.gross,
            emphasize: true,
          },
        ]}
      />
    </div>
  )
}

function SimpleDocumentLineRow({
  line,
  disabled,
  currencyCode,
  i18nPrefix,
  t,
  canRemove,
  productMetaRef,
  onUpdate,
  onRemove,
}: {
  line: SimpleDocumentLineDraft
  disabled?: boolean
  currencyCode: string
  i18nPrefix: string
  t: (key: string, fallback?: string) => string
  canRemove: boolean
  productMetaRef: React.MutableRefObject<Map<string, { label: string; serviceLineCode: string | null }>>
  onUpdate: (patch: Partial<SimpleDocumentLineDraft>) => void
  onRemove: () => void
}) {
  const amounts = lineAmounts(line)
  const subscription = isSubscriptionLine(line.serviceLineCode)

  return (
    <>
      <tr className="border-t align-top">
        <td className="px-3 py-2 min-w-0">
          <EntitySearchCombobox
            value={line.productId}
            onChange={(next) => {
              const meta = productMetaRef.current.get(next)
              onUpdate({
                productId: next,
                productLabel: meta?.label ?? next,
                serviceLineCode: meta?.serviceLineCode ?? null,
                ...(isSubscriptionLine(meta?.serviceLineCode)
                  ? {}
                  : { subscriptionStartsAt: '', subscriptionEndsAt: '' }),
              })
            }}
            options={mergeEntitySearchOption([], line.productId, line.productLabel || line.productId)}
            onRemoteSearch={async (q) => {
              const rows = await remoteSearchProducts(q)
              for (const row of rows) {
                productMetaRef.current.set(row.value, {
                  label: row.label,
                  serviceLineCode: row.serviceLineCode,
                })
              }
              return mergeEntitySearchOption(
                rows.map(({ value: productValue, label }) => ({ value: productValue, label })),
                line.productId,
                line.productLabel || line.productId,
              )
            }}
            placeholder={t(`${i18nPrefix}.lines.productSearch`, 'Search products…')}
            disabled={disabled}
            createInNewTabHref="/backend/catalog/products/create"
            createInNewTabAriaLabel={t(`${i18nPrefix}.lines.productCreateTab`, 'Open new product in a new tab')}
          />
        </td>
        <td className="px-3 py-2 min-w-0">
          <input
            className={`${CRUD_FORM_TEXT_INPUT_CLASS} w-full`}
            value={line.quantity}
            disabled={disabled}
            inputMode="decimal"
            onChange={(event) => onUpdate({ quantity: event.target.value })}
          />
        </td>
        <td className="px-3 py-2 min-w-0">
          <input
            className={`${CRUD_FORM_TEXT_INPUT_CLASS} w-full`}
            value={line.unitPriceNet}
            disabled={disabled}
            inputMode="decimal"
            onChange={(event) => onUpdate({ unitPriceNet: event.target.value })}
          />
        </td>
        <td className="px-3 py-2 min-w-0">
          <input
            className={`${CRUD_FORM_TEXT_INPUT_CLASS} w-full`}
            value={line.taxRate}
            disabled={disabled}
            inputMode="decimal"
            onChange={(event) => onUpdate({ taxRate: event.target.value })}
          />
        </td>
        <td className="px-3 py-2 min-w-0">
          <input
            className={`${CRUD_FORM_TEXT_INPUT_CLASS} w-full`}
            value={line.unitPriceGross}
            disabled={disabled}
            inputMode="decimal"
            placeholder={t(`${i18nPrefix}.lines.unitPriceGrossHint`, 'Auto')}
            onChange={(event) => onUpdate({ unitPriceGross: event.target.value })}
          />
        </td>
        <td className="px-3 py-2 text-right tabular-nums">
          <div className="space-y-0.5">
            <PriceWithCurrency amount={amounts.gross} currency={currencyCode} className="font-mono text-sm font-medium" />
            <div className="text-xs text-muted-foreground">
              <PriceWithCurrency amount={amounts.net} currency={currencyCode} className="font-mono text-xs" />
            </div>
          </div>
        </td>
        <td className="px-2 py-2 text-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || !canRemove}
            onClick={onRemove}
            aria-label={t(`${i18nPrefix}.lines.remove`, 'Remove')}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </td>
      </tr>
      {subscription ? (
        <tr className="bg-muted/20">
          <td colSpan={7} className="px-3 py-2">
            <div className="grid gap-3 sm:grid-cols-2 max-w-xl">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-muted-foreground">
                  {t(`${i18nPrefix}.lines.subscriptionStartsAt`, 'Subscription start')}
                </label>
                <input
                  type="date"
                  className={CRUD_FORM_TEXT_INPUT_CLASS}
                  value={line.subscriptionStartsAt}
                  disabled={disabled}
                  onChange={(event) => onUpdate({ subscriptionStartsAt: event.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-muted-foreground">
                  {t(`${i18nPrefix}.lines.subscriptionEndsAt`, 'Subscription end')}
                </label>
                <input
                  type="date"
                  className={CRUD_FORM_TEXT_INPUT_CLASS}
                  value={line.subscriptionEndsAt}
                  disabled={disabled}
                  onChange={(event) => onUpdate({ subscriptionEndsAt: event.target.value })}
                />
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}

export function buildSimpleDocumentFormFields(args: {
  kind: SimpleDocumentKind
  mode: 'create' | 'edit'
  i18nPrefix: string
  t: (key: string, fallback?: string) => string
}): CrudField[] {
  const { kind, mode, i18nPrefix, t } = args
  return [
    {
      id: 'customerEntityId',
      type: 'custom',
      label: t(`${i18nPrefix}.fields.customer`, 'Customer'),
      required: true,
      layout: 'full',
      component: ({ value, setValue, setFormValue, disabled, values }) => (
        <SimpleDocumentCustomerField
          value={value}
          setValue={(next) => setValue(next)}
          setFormValue={setFormValue}
          disabled={disabled}
          customerLabel={typeof values?.customerLabel === 'string' ? values.customerLabel : undefined}
          i18nPrefix={i18nPrefix}
          t={t}
        />
      ),
    },
    ...(kind === 'quote' || kind === 'order'
      ? [
          {
            id: 'ownerUserId',
            type: 'custom' as const,
            label: t(`${i18nPrefix}.fields.owner`, 'Owner'),
            layout: 'half' as const,
            component: ({
              value,
              setValue,
              disabled,
              values,
            }: {
              value: unknown
              setValue: (next: unknown) => void
              disabled?: boolean
              values?: Record<string, unknown>
            }) => {
              const str = typeof value === 'string' ? value : ''
              const ownerLabel =
                typeof values?.ownerLabel === 'string' && values.ownerLabel.trim().length
                  ? values.ownerLabel
                  : str
              return (
                <EntitySearchCombobox
                  value={str}
                  onChange={(next) => setValue(next)}
                  options={mergeEntitySearchOption([], str, ownerLabel)}
                  onRemoteSearch={remoteSearchAuthUsers}
                  placeholder={t(`${i18nPrefix}.fields.ownerSearch`, 'Search users…')}
                  disabled={disabled}
                />
              )
            },
          },
          {
            id: 'referringPartnerEntityId',
            type: 'custom' as const,
            label: t(`${i18nPrefix}.fields.referringPartner`, 'Referring party'),
            layout: 'half' as const,
            component: ({
              value,
              setValue,
              setFormValue,
              disabled,
              values,
            }: {
              value: unknown
              setValue: (next: unknown) => void
              setFormValue?: (id: string, next: unknown) => void
              disabled?: boolean
              values?: Record<string, unknown>
            }) => {
              const str = typeof value === 'string' ? value : ''
              const partnerLabel =
                typeof values?.referringPartnerLabel === 'string' &&
                values.referringPartnerLabel.trim().length
                  ? values.referringPartnerLabel
                  : str
              const personPrefix = t(`${i18nPrefix}.fields.referringPartnerPerson`, 'Person')
              const companyPrefix = t(`${i18nPrefix}.fields.referringPartnerCompany`, 'Company')
              return (
                <div className="space-y-2">
                  <EntitySearchCombobox
                    value={str}
                    onChange={(next) => {
                      setValue(next)
                      setFormValue?.('referringPartnerLabel', '')
                      setFormValue?.('referringPartnerProgramId', '')
                    }}
                    options={mergeEntitySearchOption([], str, partnerLabel)}
                    onRemoteSearch={(query) =>
                      remoteSearchReferringPartners(query, { personPrefix, companyPrefix })
                    }
                    placeholder={t(
                      `${i18nPrefix}.fields.referringPartnerSearch`,
                      'Search partners…',
                    )}
                    disabled={disabled}
                  />
                  {kind === 'order' ? (
                    <ReferringPartnerProgramField
                      value={values?.referringPartnerProgramId ?? ''}
                      setValue={(next) => setFormValue?.('referringPartnerProgramId', next)}
                      partnerEntityId={str}
                      disabled={disabled}
                      i18nPrefix={i18nPrefix}
                      t={t}
                    />
                  ) : null}
                </div>
              )
            },
          },
        ]
      : []),
    {
      id: 'statusEntryId',
      type: 'custom',
      label: t(`${i18nPrefix}.fields.status`, 'Status'),
      layout: 'quarter',
      component: ({ value, setValue, disabled }) => (
        <SimpleDocumentStatusField
          value={value}
          setValue={(next) => setValue(next)}
          disabled={disabled}
          kind={kind}
          i18nPrefix={i18nPrefix}
          t={t}
        />
      ),
    },
    {
      id: 'currencyCode',
      type: 'custom',
      label: t(`${i18nPrefix}.fields.currency`, 'Currency'),
      required: true,
      layout: 'quarter',
      component: ({ value, setValue, disabled }) => (
        <SimpleDocumentCurrencyField
          value={value}
          setValue={(next) => setValue(next)}
          disabled={disabled}
          i18nPrefix={i18nPrefix}
          t={t}
        />
      ),
    },
    {
      id: 'documentDate',
      type: 'date',
      label:
        kind === 'order'
          ? t(`${i18nPrefix}.fields.placedAt`, 'Order date')
          : t(`${i18nPrefix}.fields.validFrom`, 'Quote date'),
      required: true,
      layout: 'quarter',
    },
    ...(mode === 'edit'
      ? [
          {
            id: 'documentNumber',
            type: 'text' as const,
            label: t(`${i18nPrefix}.fields.number`, 'Number'),
            layout: 'quarter' as const,
          },
        ]
      : []),
    {
      id: 'lines',
      type: 'custom',
      label: '',
      layout: 'full',
      component: ({ value, setValue, disabled, values }) => (
        <SimpleDocumentLinesTable
          value={value}
          setValue={(next) => setValue(next)}
          disabled={disabled}
          currencyCode={
            typeof values?.currencyCode === 'string' && values.currencyCode.trim()
              ? values.currencyCode.trim().toUpperCase()
              : 'PLN'
          }
          i18nPrefix={i18nPrefix}
          t={t}
        />
      ),
    },
  ]
}

export function buildSimpleDocumentFormGroups(
  kind: SimpleDocumentKind,
  i18nPrefix: string,
  t: (key: string, fallback?: string) => string,
): CrudFormGroup[] {
  return [
    {
      id: 'basics',
      title: t(`${i18nPrefix}.form.groups.basics`, 'Basics'),
      column: 1,
      fields: [
        'customerEntityId',
        ...(kind === 'quote' || kind === 'order'
          ? (['ownerUserId', 'referringPartnerEntityId'] as const)
          : []),
        'statusEntryId',
        'currencyCode',
        'documentDate',
        'documentNumber',
      ],
    },
    {
      id: 'lines',
      column: 1,
      fields: ['lines'],
    },
  ]
}
