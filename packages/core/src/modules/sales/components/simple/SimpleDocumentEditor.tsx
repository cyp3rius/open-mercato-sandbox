"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ApplyBreadcrumb } from '@open-mercato/ui/backend/AppShell'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { LoadingMessage, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { Button } from '@open-mercato/ui/primitives/button'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { createCrud, updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { createCrudFormError } from '@open-mercato/ui/backend/utils/serverErrors'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { ArrowRightLeft } from 'lucide-react'
import {
  readCurrencyCodeFromSearchParams,
  readCustomerEntityIdFromSearchParams,
  readOwnerUserIdFromSearchParams,
  readSourceDealIdFromSearchParams,
} from '@open-mercato/core/modules/customers/components/detail/customerEntityCreatePrefill'
import {
  resolveCustomerEntityDisplayLabel,
  resolveUserDisplayLabel,
} from '@open-mercato/core/modules/procurement/lib/procurementEntitySearch'
import type { SimpleDocumentKind } from './SimpleDocumentsTable'
import {
  buildSimpleOrderCreateFromOfferHref,
  readLinkedOrderIdFromQuoteDoc,
  readSourceOfferIdFromSearchParams,
} from './simpleDocumentCreatePrefill'
import {
  buildSimpleDocumentFormFields,
  buildSimpleDocumentFormGroups,
  defaultSimpleDocumentValues,
  fetchSimpleDocumentPrefillValues,
  fetchSimpleOrderPrefillFromQuote,
  fetchSimpleQuotePrefillFromDeal,
  isSimpleDocumentProductPrefillId,
  isSubscriptionLine,
  hydrateSimpleDocumentLineProductLabels,
  mapSalesLineApiItemToDraft,
  type SimpleDocumentFormValues,
  type SimpleDocumentLineDraft,
} from './simpleDocumentFormConfig'

type SimpleDocumentEditorProps = {
  kind: SimpleDocumentKind
  mode: 'create' | 'edit'
  documentId?: string
}

function datePickerToIsoStart(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  return `${trimmed}T00:00:00.000Z`
}

function datePickerToIsoEnd(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  return `${trimmed}T23:59:59.999Z`
}

function isoToDateInput(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return ''
  return value.slice(0, 10)
}

export function SimpleDocumentEditor({ kind, mode, documentId }: SimpleDocumentEditorProps) {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const i18nPrefix = kind === 'order' ? 'sales.simpleOrders' : 'sales.simpleQuotes'
  const resource = kind === 'order' ? 'orders' : 'quotes'
  const linesResource = kind === 'order' ? 'order-lines' : 'quote-lines'
  const basePath = kind === 'order' ? '/backend/sales/simple-orders' : '/backend/sales/simple-quotes'
  const parentFk = kind === 'order' ? 'orderId' : 'quoteId'
  const prefillProductId = mode === 'create' ? searchParams.get('productId') : null
  const hasPrefillProduct = isSimpleDocumentProductPrefillId(prefillProductId)
  const prefillCustomerEntityId =
    mode === 'create' ? readCustomerEntityIdFromSearchParams(searchParams) : ''
  const prefillOwnerUserId = mode === 'create' ? readOwnerUserIdFromSearchParams(searchParams) : ''
  const prefillCurrencyCode = mode === 'create' ? readCurrencyCodeFromSearchParams(searchParams) : ''
  const prefillSourceDealId =
    mode === 'create' && kind === 'quote' ? readSourceDealIdFromSearchParams(searchParams) : ''
  const prefillSourceOfferId =
    mode === 'create' && kind === 'order' ? readSourceOfferIdFromSearchParams(searchParams) : ''
  const hasPrefillCustomerOrOwner = Boolean(prefillCustomerEntityId || prefillOwnerUserId)
  const hasCreatePrefill = Boolean(
    hasPrefillProduct ||
      hasPrefillCustomerOrOwner ||
      prefillCurrencyCode ||
      prefillSourceDealId ||
      prefillSourceOfferId,
  )

  const [loading, setLoading] = React.useState(mode === 'edit' || hasCreatePrefill)
  const [error, setError] = React.useState<string | null>(null)
  const [initialValues, setInitialValues] = React.useState<SimpleDocumentFormValues>(() => {
    const base = defaultSimpleDocumentValues()
    if (mode !== 'create') return base
    return {
      ...base,
      customerEntityId: prefillCustomerEntityId,
      customerLabel: '',
      ownerUserId: prefillOwnerUserId,
      ownerLabel: '',
      currencyCode: prefillCurrencyCode || base.currencyCode,
    }
  })
  const [formKey, setFormKey] = React.useState(0)
  const [linkedOrderId, setLinkedOrderId] = React.useState<string | null>(null)
  const [createReady, setCreateReady] = React.useState(mode !== 'create' || !hasCreatePrefill)
  const [prefillQuoteNumber, setPrefillQuoteNumber] = React.useState('')
  const [prefillDealTitle, setPrefillDealTitle] = React.useState('')

  const loadCreatePrefillLabels = React.useCallback(async () => {
    if (mode !== 'create' || !hasPrefillCustomerOrOwner) return null
    const [customerLabel, ownerLabel] = await Promise.all([
      prefillCustomerEntityId
        ? resolveCustomerEntityDisplayLabel(prefillCustomerEntityId)
        : Promise.resolve(null),
      prefillOwnerUserId ? resolveUserDisplayLabel(prefillOwnerUserId) : Promise.resolve(null),
    ])
    return {
      customerLabel: customerLabel ?? '',
      ownerLabel: ownerLabel ?? '',
    }
  }, [hasPrefillCustomerOrOwner, mode, prefillCustomerEntityId, prefillOwnerUserId])

  const loadPrefillProduct = React.useCallback(async () => {
    if (mode !== 'create' || !hasCreatePrefill) {
      setCreateReady(true)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      if (prefillSourceDealId && kind === 'quote') {
        const fromDeal = await fetchSimpleQuotePrefillFromDeal(prefillSourceDealId)
        if (!fromDeal) {
          flash(
            t(
              `${i18nPrefix}.errors.prefillDeal`,
              'Could not load the selected deal for the new quote.',
            ),
            'error',
          )
          setCreateReady(true)
          setLoading(false)
          return
        }
        const [ownerLabel, customerLabel] = await Promise.all([
          fromDeal.values.ownerUserId
            ? resolveUserDisplayLabel(fromDeal.values.ownerUserId)
            : Promise.resolve(null),
          fromDeal.values.customerEntityId
            ? resolveCustomerEntityDisplayLabel(fromDeal.values.customerEntityId)
            : Promise.resolve(null),
        ])
        setPrefillDealTitle(fromDeal.dealTitle)
        setInitialValues({
          ...fromDeal.values,
          customerLabel: customerLabel ?? '',
          ownerLabel: ownerLabel ?? '',
        })
        setFormKey((key) => key + 1)
        return
      }

      if (prefillSourceOfferId) {
        const fromQuote = await fetchSimpleOrderPrefillFromQuote(prefillSourceOfferId)
        if (!fromQuote) {
          flash(
            t(
              `${i18nPrefix}.errors.prefillQuote`,
              'Could not load the selected quote for the new order.',
            ),
            'error',
          )
          setCreateReady(true)
          setLoading(false)
          return
        }
        const ownerLabel = fromQuote.values.ownerUserId
          ? ((await resolveUserDisplayLabel(fromQuote.values.ownerUserId)) ?? '')
          : ''
        const customerLabel =
          fromQuote.values.customerLabel ||
          (fromQuote.values.customerEntityId
            ? ((await resolveCustomerEntityDisplayLabel(fromQuote.values.customerEntityId)) ?? '')
            : '')
        setPrefillQuoteNumber(fromQuote.quoteNumber)
        setInitialValues({
          ...fromQuote.values,
          customerLabel,
          ownerLabel,
        })
        setFormKey((key) => key + 1)
        return
      }

      const labels = await loadCreatePrefillLabels()
      const applyDealPrefill = (values: SimpleDocumentFormValues): SimpleDocumentFormValues => ({
        ...values,
        customerEntityId: prefillCustomerEntityId || values.customerEntityId,
        customerLabel:
          labels?.customerLabel ||
          (prefillCustomerEntityId ? values.customerLabel : values.customerLabel),
        ownerUserId: prefillOwnerUserId || values.ownerUserId,
        ownerLabel: labels?.ownerLabel || (prefillOwnerUserId ? values.ownerLabel : values.ownerLabel),
        currencyCode: prefillCurrencyCode || values.currencyCode,
      })
      if (hasPrefillProduct && prefillProductId) {
        const prefilled = await fetchSimpleDocumentPrefillValues(prefillProductId.trim())
        if (prefilled) {
          setInitialValues(applyDealPrefill(prefilled))
          setFormKey((key) => key + 1)
        } else {
          flash(
            t(
              `${i18nPrefix}.errors.prefillProduct`,
              'Could not load the selected product for the new document.',
            ),
            'error',
          )
          setInitialValues(
            applyDealPrefill({
              ...defaultSimpleDocumentValues(),
              customerLabel: labels?.customerLabel ?? '',
              ownerLabel: labels?.ownerLabel ?? '',
            }),
          )
          setFormKey((key) => key + 1)
        }
      } else {
        setInitialValues(
          applyDealPrefill({
            ...defaultSimpleDocumentValues(),
            customerEntityId: prefillCustomerEntityId,
            customerLabel: labels?.customerLabel ?? '',
            ownerUserId: prefillOwnerUserId,
            ownerLabel: labels?.ownerLabel ?? '',
          }),
        )
        setFormKey((key) => key + 1)
      }
    } catch (err) {
      console.error('simple.document.prefill failed', err)
      if (prefillSourceDealId && kind === 'quote') {
        flash(
          t(
            `${i18nPrefix}.errors.prefillDeal`,
            'Could not load the selected deal for the new quote.',
          ),
          'error',
        )
      } else if (prefillSourceOfferId) {
        flash(
          t(
            `${i18nPrefix}.errors.prefillQuote`,
            'Could not load the selected quote for the new order.',
          ),
          'error',
        )
      } else if (hasPrefillProduct) {
        flash(
          t(
            `${i18nPrefix}.errors.prefillProduct`,
            'Could not load the selected product for the new document.',
          ),
          'error',
        )
      }
      setInitialValues({
        ...defaultSimpleDocumentValues(),
        customerEntityId: prefillCustomerEntityId,
        customerLabel: '',
        ownerUserId: prefillOwnerUserId,
        ownerLabel: '',
        currencyCode: prefillCurrencyCode || defaultSimpleDocumentValues().currencyCode,
      })
      setFormKey((key) => key + 1)
    } finally {
      setCreateReady(true)
      setLoading(false)
    }
  }, [
    hasCreatePrefill,
    hasPrefillProduct,
    i18nPrefix,
    kind,
    loadCreatePrefillLabels,
    mode,
    prefillCurrencyCode,
    prefillCustomerEntityId,
    prefillOwnerUserId,
    prefillProductId,
    prefillSourceDealId,
    prefillSourceOfferId,
    t,
  ])

  const loadDocument = React.useCallback(async () => {
    if (!documentId) {
      setError(t(`${i18nPrefix}.errors.notFound`, 'Document not found.'))
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const docCall = await apiCall<Record<string, unknown>>(`/api/sales/${resource}?id=${documentId}`)
      const items = Array.isArray(docCall.result?.items)
        ? (docCall.result.items as Array<Record<string, unknown>>)
        : docCall.result && typeof docCall.result === 'object' && 'id' in (docCall.result as object)
          ? [docCall.result as Record<string, unknown>]
          : []
      const doc = items[0]
      if (!doc) {
        setError(t(`${i18nPrefix}.errors.notFound`, 'Document not found.'))
        return
      }
      if (kind === 'quote') {
        setLinkedOrderId(readLinkedOrderIdFromQuoteDoc(doc))
      } else {
        setLinkedOrderId(null)
      }
      const snapshot =
        doc.customerSnapshot && typeof doc.customerSnapshot === 'object'
          ? (doc.customerSnapshot as Record<string, unknown>)
          : null
      const customer = snapshot?.customer as Record<string, unknown> | undefined
      const customerEntityId = typeof doc.customerEntityId === 'string' ? doc.customerEntityId : ''
      const customerLabel =
        typeof customer?.displayName === 'string'
          ? customer.displayName
          : customerEntityId

      const ownerUserId = typeof doc.ownerUserId === 'string' ? doc.ownerUserId : ''
      const ownerLabel = ownerUserId
        ? ((await resolveUserDisplayLabel(ownerUserId)) ?? ownerUserId)
        : ''

      const linesCall = await apiCall<{ items?: Array<Record<string, unknown>> }>(
        `/api/sales/${linesResource}?${parentFk}=${documentId}&page=1&pageSize=100`,
      )
      const lineItems = Array.isArray(linesCall.result?.items) ? linesCall.result.items : []
      const mappedLines: SimpleDocumentLineDraft[] = lineItems.length
        ? lineItems.map((item) => mapSalesLineApiItemToDraft(item, { keepId: true }))
        : defaultSimpleDocumentValues().lines
      const lines = await hydrateSimpleDocumentLineProductLabels(mappedLines)

      setInitialValues({
        customerEntityId,
        customerLabel,
        ownerUserId,
        ownerLabel,
        statusEntryId: typeof doc.statusEntryId === 'string' ? doc.statusEntryId : '',
        currencyCode: typeof doc.currencyCode === 'string' ? doc.currencyCode : 'EUR',
        documentNumber:
          kind === 'order'
            ? typeof doc.orderNumber === 'string'
              ? doc.orderNumber
              : ''
            : typeof doc.quoteNumber === 'string'
              ? doc.quoteNumber
              : '',
        documentDate:
          isoToDateInput(kind === 'order' ? doc.placedAt : doc.validFrom) ||
          new Date().toISOString().slice(0, 10),
        lines,
      })
    } catch (err) {
      console.error('simple.document.load failed', err)
      setError(t(`${i18nPrefix}.errors.load`, 'Failed to load document.'))
    } finally {
      setLoading(false)
    }
  }, [documentId, i18nPrefix, kind, linesResource, parentFk, resource, t])

  React.useEffect(() => {
    if (mode === 'edit') void loadDocument()
  }, [loadDocument, mode])

  React.useEffect(() => {
    if (mode === 'create') void loadPrefillProduct()
  }, [loadPrefillProduct, mode])

  const fields = React.useMemo(
    () => buildSimpleDocumentFormFields({ kind, mode, i18nPrefix, t }),
    [i18nPrefix, kind, mode, t],
  )
  const groups = React.useMemo(
    () => buildSimpleDocumentFormGroups(kind, i18nPrefix, t),
    [i18nPrefix, kind, t],
  )

  const validate = React.useCallback(
    (values: SimpleDocumentFormValues): void => {
      if (!values.customerEntityId.trim()) {
        throw createCrudFormError(
          t(`${i18nPrefix}.errors.customerRequired`, 'Customer is required.'),
          { customerEntityId: t(`${i18nPrefix}.errors.customerRequired`, 'Customer is required.') },
        )
      }
      if (!/^[A-Z]{3}$/.test(values.currencyCode.trim().toUpperCase())) {
        throw createCrudFormError(
          t(`${i18nPrefix}.errors.currencyRequired`, 'Currency must be a 3-letter ISO code.'),
          { currencyCode: t(`${i18nPrefix}.errors.currencyRequired`, 'Currency must be a 3-letter ISO code.') },
        )
      }
      const lines = Array.isArray(values.lines) ? values.lines : []
      if (!lines.length) {
        throw createCrudFormError(t(`${i18nPrefix}.errors.linesRequired`, 'Add at least one line.'))
      }
      for (const line of lines) {
        if (!line.productId) {
          throw createCrudFormError(t(`${i18nPrefix}.errors.productRequired`, 'Each line needs a product.'))
        }
        const qty = Number(line.quantity)
        const net = Number(line.unitPriceNet)
        const tax = Number(line.taxRate)
        if (!Number.isFinite(qty) || qty <= 0) {
          throw createCrudFormError(
            t(`${i18nPrefix}.errors.quantityRequired`, 'Quantity must be greater than zero.'),
          )
        }
        if (!Number.isFinite(net) || net < 0) {
          throw createCrudFormError(t(`${i18nPrefix}.errors.priceRequired`, 'Unit price (net) is required.'))
        }
        if (!Number.isFinite(tax) || tax < 0) {
          throw createCrudFormError(t(`${i18nPrefix}.errors.taxRequired`, 'Tax rate is required.'))
        }
        if (isSubscriptionLine(line.serviceLineCode)) {
          if (!line.subscriptionStartsAt || !line.subscriptionEndsAt) {
            throw createCrudFormError(
              t(
                `${i18nPrefix}.errors.subscriptionDatesRequired`,
                'Subscription products require start and end dates.',
              ),
            )
          }
          if (line.subscriptionStartsAt > line.subscriptionEndsAt) {
            throw createCrudFormError(
              t(
                `${i18nPrefix}.errors.subscriptionDateOrder`,
                'Subscription start must be on or before end.',
              ),
            )
          }
        }
      }
    },
    [i18nPrefix, t],
  )

  const buildLinePayload = React.useCallback(
    (line: SimpleDocumentLineDraft, parentId: string, currencyCode: string) => {
      const net = Number(line.unitPriceNet)
      const tax = Number(line.taxRate)
      const gross =
        line.unitPriceGross.trim().length > 0
          ? Number(line.unitPriceGross)
          : Number((net * (1 + tax / 100)).toFixed(4))
      const payload: Record<string, unknown> = {
        [parentFk]: parentId,
        productId: line.productId,
        quantity: Number(line.quantity),
        currencyCode: currencyCode.trim().toUpperCase(),
        unitPriceNet: net,
        taxRate: tax,
        unitPriceGross: gross,
      }
      if (line.id) payload.id = line.id
      const productName = line.productLabel.trim()
      if (productName && productName !== line.productId.trim()) {
        payload.name = productName
      }
      if (isSubscriptionLine(line.serviceLineCode)) {
        payload.subscriptionStartsAt = datePickerToIsoStart(line.subscriptionStartsAt)
        payload.subscriptionEndsAt = datePickerToIsoEnd(line.subscriptionEndsAt)
      }
      return payload
    },
    [parentFk],
  )

  const handleSubmit = React.useCallback(
    async (values: SimpleDocumentFormValues) => {
      validate(values)
      const header: Record<string, unknown> = {
        customerEntityId: values.customerEntityId,
        currencyCode: values.currencyCode.trim().toUpperCase(),
        statusEntryId: values.statusEntryId || undefined,
      }
      if (kind === 'order') {
        header.placedAt = datePickerToIsoStart(values.documentDate)
        if (values.documentNumber.trim()) header.orderNumber = values.documentNumber.trim()
        header.ownerUserId = values.ownerUserId.trim() ? values.ownerUserId.trim() : null
        if (mode === 'create' && prefillSourceOfferId) {
          header.metadata = { sourceOfferId: prefillSourceOfferId }
          header.comments = prefillQuoteNumber
            ? `From quote: ${prefillQuoteNumber}`
            : `From quote ${prefillSourceOfferId}`
        }
      } else {
        header.validFrom = datePickerToIsoStart(values.documentDate)
        if (values.documentNumber.trim()) header.quoteNumber = values.documentNumber.trim()
        header.ownerUserId = values.ownerUserId.trim() ? values.ownerUserId.trim() : null
        if (mode === 'create' && prefillSourceDealId) {
          header.metadata = { sourceDealId: prefillSourceDealId }
          header.comments = prefillDealTitle.trim()
            ? `From deal: ${prefillDealTitle.trim()}`
            : `From deal ${prefillSourceDealId}`
        }
      }

      const lines = Array.isArray(values.lines) ? values.lines : []

      if (mode === 'create') {
        const created = await createCrud<{ id?: string }>(`sales/${resource}`, header, {
          errorMessage: t(`${i18nPrefix}.errors.save`, 'Failed to save.'),
        })
        let id =
          typeof created.result?.id === 'string'
            ? created.result.id
            : typeof (created.result as { quoteId?: string } | undefined)?.quoteId === 'string'
              ? (created.result as { quoteId: string }).quoteId
              : typeof (created.result as { orderId?: string } | undefined)?.orderId === 'string'
                ? (created.result as { orderId: string }).orderId
                : undefined
        if (!id) {
          const list = await apiCall<{ items?: Array<{ id?: string }> }>(
            `/api/sales/${resource}?page=1&pageSize=1&sortField=createdAt&sortDir=desc`,
          )
          id = list.result?.items?.[0]?.id
        }
        if (!id) throw new Error(t(`${i18nPrefix}.errors.save`, 'Failed to save.'))
        for (const line of lines) {
          const lineCall = await apiCall(`/api/sales/${linesResource}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(buildLinePayload(line, id, values.currencyCode)),
          })
          if (!lineCall.ok) {
            throw new Error(t(`${i18nPrefix}.errors.save`, 'Failed to save.'))
          }
        }
        if (kind === 'quote' && prefillSourceDealId) {
          try {
            const dealCall = await apiCall<{
              deal?: { payload?: Record<string, unknown> | null }
            }>(`/api/customers/deals/${encodeURIComponent(prefillSourceDealId)}`)
            const existingPayload =
              dealCall.result?.deal?.payload && typeof dealCall.result.deal.payload === 'object'
                ? dealCall.result.deal.payload
                : {}
            await updateCrud(
              'customers/deals',
              {
                id: prefillSourceDealId,
                payload: {
                  ...existingPayload,
                  simpleQuoteId: id,
                  sourceDealId: prefillSourceDealId,
                },
              },
              {
                errorMessage: t(
                  `${i18nPrefix}.errors.linkDeal`,
                  'Quote saved, but linking back to the deal failed.',
                ),
              },
            )
          } catch (err) {
            console.error('simple.quote.linkDeal failed', err)
            flash(
              t(
                `${i18nPrefix}.errors.linkDeal`,
                'Quote saved, but linking back to the deal failed.',
              ),
              'error',
            )
          }
        }
        if (kind === 'order' && prefillSourceOfferId) {
          try {
            const quoteCall = await apiCall<Record<string, unknown>>(
              `/api/sales/quotes?id=${encodeURIComponent(prefillSourceOfferId)}`,
            )
            const items = Array.isArray(quoteCall.result?.items)
              ? (quoteCall.result.items as Array<Record<string, unknown>>)
              : quoteCall.result &&
                  typeof quoteCall.result === 'object' &&
                  'id' in (quoteCall.result as object)
                ? [quoteCall.result as Record<string, unknown>]
                : []
            const quoteDoc = items[0]
            const existingMetadata =
              quoteDoc?.metadata &&
              typeof quoteDoc.metadata === 'object' &&
              !Array.isArray(quoteDoc.metadata)
                ? (quoteDoc.metadata as Record<string, unknown>)
                : {}
            await updateCrud(
              'sales/quotes',
              {
                id: prefillSourceOfferId,
                metadata: {
                  ...existingMetadata,
                  simpleOrderId: id,
                  sourceOfferId: prefillSourceOfferId,
                },
              },
              {
                errorMessage: t(
                  `${i18nPrefix}.errors.linkQuote`,
                  'Order saved, but linking back to the quote failed.',
                ),
              },
            )
          } catch (err) {
            console.error('simple.order.linkQuote failed', err)
            flash(
              t(
                `${i18nPrefix}.errors.linkQuote`,
                'Order saved, but linking back to the quote failed.',
              ),
              'error',
            )
          }
        }
        flash(t(`${i18nPrefix}.success.create`, 'Created.'), 'success')
        router.push(`${basePath}/${id}`)
        return
      }

      if (!documentId) return
      await updateCrud(`sales/${resource}`, { id: documentId, ...header }, {
        errorMessage: t(`${i18nPrefix}.errors.save`, 'Failed to save.'),
      })
      const existingIds = new Set(lines.map((line) => line.id).filter(Boolean) as string[])
      const currentLinesCall = await apiCall<{ items?: Array<{ id?: string }> }>(
        `/api/sales/${linesResource}?${parentFk}=${documentId}&page=1&pageSize=100`,
      )
      const currentIds = (currentLinesCall.result?.items ?? [])
        .map((item) => item.id)
        .filter((value): value is string => typeof value === 'string')
      for (const currentId of currentIds) {
        if (!existingIds.has(currentId)) {
          await apiCall(`/api/sales/${linesResource}`, {
            method: 'DELETE',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: currentId, [parentFk]: documentId }),
          })
        }
      }
      for (const line of lines) {
        const lineCall = await apiCall(`/api/sales/${linesResource}`, {
          method: line.id ? 'PUT' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(buildLinePayload(line, documentId, values.currencyCode)),
        })
        if (!lineCall.ok) {
          throw new Error(t(`${i18nPrefix}.errors.save`, 'Failed to save.'))
        }
      }
      flash(t(`${i18nPrefix}.success.save`, 'Saved.'), 'success')
      setFormKey((key) => key + 1)
      void loadDocument()
    },
    [
      basePath,
      buildLinePayload,
      documentId,
      i18nPrefix,
      kind,
      linesResource,
      loadDocument,
      mode,
      parentFk,
      prefillDealTitle,
      prefillQuoteNumber,
      prefillSourceDealId,
      prefillSourceOfferId,
      resource,
      router,
      t,
      validate,
    ],
  )

  const handleConvert = React.useCallback(() => {
    if (!documentId || kind !== 'quote') return
    router.push(buildSimpleOrderCreateFromOfferHref(documentId))
  }, [documentId, kind, router])

  if ((mode === 'edit' && loading) || (mode === 'create' && (!createReady || loading))) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t(`${i18nPrefix}.loading`, 'Loading…')} />
        </PageBody>
      </Page>
    )
  }

  if (mode === 'edit' && error) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage
            label={error}
            action={(
              <Button asChild type="button" variant="outline">
                <Link href={basePath}>{t(`${i18nPrefix}.list.title`, kind === 'order' ? 'Orders' : 'Quotes')}</Link>
              </Button>
            )}
          />
        </PageBody>
      </Page>
    )
  }

  const title =
    mode === 'create'
      ? t(`${i18nPrefix}.create.title`, kind === 'order' ? 'Create order' : 'Create quote')
      : initialValues.documentNumber ||
        t(`${i18nPrefix}.detail.title`, kind === 'order' ? 'Order' : 'Quote')

  return (
    <>
      {mode === 'edit' ? (
        <ApplyBreadcrumb
          title={title}
          breadcrumb={[
            { label: t(`${i18nPrefix}.list.title`, kind === 'order' ? 'Orders' : 'Quotes'), href: basePath },
            { label: title },
          ]}
        />
      ) : null}
      <Page>
        <PageBody>
          <CrudForm<SimpleDocumentFormValues>
            key={formKey}
            title={title}
            backHref={basePath}
            cancelHref={basePath}
            submitLabel={t(`${i18nPrefix}.actions.save`, 'Save')}
            fields={fields}
            groups={groups}
            initialValues={initialValues}
            onSubmit={handleSubmit}
            extraActions={
              kind === 'quote' && mode === 'edit' ? (
                linkedOrderId ? (
                  <Button asChild type="button" variant="outline">
                    <Link href={`/backend/sales/simple-orders/${encodeURIComponent(linkedOrderId)}`}>
                      {t(`${i18nPrefix}.actions.openOrder`, 'Open order')}
                    </Link>
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={handleConvert}>
                    <ArrowRightLeft className="mr-2 h-4 w-4" aria-hidden />
                    {t(`${i18nPrefix}.actions.convertToOrder`, 'Convert to order')}
                  </Button>
                )
              ) : undefined
            }
          />
        </PageBody>
      </Page>
    </>
  )
}

export default SimpleDocumentEditor
