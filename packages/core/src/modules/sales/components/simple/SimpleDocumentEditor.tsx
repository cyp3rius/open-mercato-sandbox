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
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { SimpleDocumentKind } from './SimpleDocumentsTable'
import {
  buildSimpleDocumentFormFields,
  buildSimpleDocumentFormGroups,
  defaultSimpleDocumentValues,
  fetchSimpleDocumentPrefillValues,
  isSimpleDocumentProductPrefillId,
  isSubscriptionLine,
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
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const i18nPrefix = kind === 'order' ? 'sales.simpleOrders' : 'sales.simpleQuotes'
  const resource = kind === 'order' ? 'orders' : 'quotes'
  const linesResource = kind === 'order' ? 'order-lines' : 'quote-lines'
  const basePath = kind === 'order' ? '/backend/sales/simple-orders' : '/backend/sales/simple-quotes'
  const parentFk = kind === 'order' ? 'orderId' : 'quoteId'
  const prefillProductId = mode === 'create' ? searchParams.get('productId') : null
  const hasPrefillProduct = isSimpleDocumentProductPrefillId(prefillProductId)

  const [loading, setLoading] = React.useState(mode === 'edit' || hasPrefillProduct)
  const [error, setError] = React.useState<string | null>(null)
  const [initialValues, setInitialValues] = React.useState<SimpleDocumentFormValues>(defaultSimpleDocumentValues())
  const [formKey, setFormKey] = React.useState(0)
  const [converting, setConverting] = React.useState(false)
  const [createReady, setCreateReady] = React.useState(mode !== 'create' || !hasPrefillProduct)

  const loadPrefillProduct = React.useCallback(async () => {
    if (mode !== 'create' || !hasPrefillProduct || !prefillProductId) {
      setCreateReady(true)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const prefilled = await fetchSimpleDocumentPrefillValues(prefillProductId.trim())
      if (prefilled) {
        setInitialValues(prefilled)
        setFormKey((key) => key + 1)
      } else {
        flash(
          t(`${i18nPrefix}.errors.prefillProduct`, 'Could not load the selected product for the new document.'),
          'error',
        )
        setInitialValues(defaultSimpleDocumentValues())
      }
    } catch (err) {
      console.error('simple.document.prefill failed', err)
      flash(
        t(`${i18nPrefix}.errors.prefillProduct`, 'Could not load the selected product for the new document.'),
        'error',
      )
      setInitialValues(defaultSimpleDocumentValues())
    } finally {
      setCreateReady(true)
      setLoading(false)
    }
  }, [hasPrefillProduct, i18nPrefix, mode, prefillProductId, t])

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

      const linesCall = await apiCall<{ items?: Array<Record<string, unknown>> }>(
        `/api/sales/${linesResource}?${parentFk}=${documentId}&page=1&pageSize=100`,
      )
      const lineItems = Array.isArray(linesCall.result?.items) ? linesCall.result.items : []
      const lines: SimpleDocumentLineDraft[] = lineItems.length
        ? lineItems.map((item) => ({
            key: typeof item.id === 'string' ? item.id : crypto.randomUUID(),
            id: typeof item.id === 'string' ? item.id : undefined,
            productId: typeof item.productId === 'string' ? item.productId : '',
            productLabel:
              typeof item.productTitle === 'string'
                ? item.productTitle
                : typeof item.productId === 'string'
                  ? item.productId
                  : '',
            serviceLineCode:
              typeof item.serviceLineCode === 'string'
                ? item.serviceLineCode
                : typeof item.service_line_code === 'string'
                  ? item.service_line_code
                  : null,
            quantity: String(item.quantity ?? '1'),
            unitPriceNet: item.unitPriceNet != null ? String(item.unitPriceNet) : '',
            taxRate: item.taxRate != null ? String(item.taxRate) : '23',
            unitPriceGross: item.unitPriceGross != null ? String(item.unitPriceGross) : '',
            subscriptionStartsAt: isoToDateInput(item.subscriptionStartsAt),
            subscriptionEndsAt: isoToDateInput(item.subscriptionEndsAt),
          }))
        : defaultSimpleDocumentValues().lines

      setInitialValues({
        customerEntityId,
        customerLabel,
        ownerUserId: typeof doc.ownerUserId === 'string' ? doc.ownerUserId : '',
        ownerLabel: typeof doc.ownerUserId === 'string' ? doc.ownerUserId : '',
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
                'Subscription lines require start and end dates.',
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
      } else {
        header.validFrom = datePickerToIsoStart(values.documentDate)
        if (values.documentNumber.trim()) header.quoteNumber = values.documentNumber.trim()
        header.ownerUserId = values.ownerUserId.trim() ? values.ownerUserId.trim() : null
      }

      const lines = Array.isArray(values.lines) ? values.lines : []

      if (mode === 'create') {
        const created = await createCrud<{ id?: string }>(`sales/${resource}`, header, {
          errorMessage: t(`${i18nPrefix}.errors.save`, 'Failed to save.'),
        })
        let id =
          typeof created.result?.id === 'string' ? created.result.id : undefined
        if (!id) {
          const list = await apiCall<{ items?: Array<{ id?: string }> }>(
            `/api/sales/${resource}?page=1&pageSize=1&sortField=createdAt&sortDir=desc`,
          )
          id = list.result?.items?.[0]?.id
        }
        if (!id) throw new Error(t(`${i18nPrefix}.errors.save`, 'Failed to save.'))
        for (const line of lines) {
          await apiCall(`/api/sales/${linesResource}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(buildLinePayload(line, id, values.currencyCode)),
          })
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
        await apiCall(`/api/sales/${linesResource}`, {
          method: line.id ? 'PUT' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(buildLinePayload(line, documentId, values.currencyCode)),
        })
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
      resource,
      router,
      t,
      validate,
    ],
  )

  const handleConvert = React.useCallback(async () => {
    if (!documentId || kind !== 'quote') return
    const ok = await confirm({
      title: t(`${i18nPrefix}.actions.convertConfirm`, 'Convert this quote to an order?'),
    })
    if (!ok) return
    setConverting(true)
    try {
      const call = await apiCall<{ orderId?: string }>('/api/sales/quotes/convert', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quoteId: documentId }),
      })
      if (!call.ok || !call.result?.orderId) {
        flash(t(`${i18nPrefix}.errors.convert`, 'Failed to convert quote to order.'), 'error')
        return
      }
      flash(t(`${i18nPrefix}.success.convert`, 'Converted to order.'), 'success')
      router.push(`/backend/sales/simple-orders/${call.result.orderId}`)
    } catch (err) {
      flash(
        err instanceof Error
          ? err.message
          : t(`${i18nPrefix}.errors.convert`, 'Failed to convert quote to order.'),
        'error',
      )
    } finally {
      setConverting(false)
    }
  }, [confirm, documentId, i18nPrefix, kind, router, t])

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
        {ConfirmDialogElement}
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
                <Button
                  type="button"
                  variant="outline"
                  disabled={converting}
                  onClick={() => void handleConvert()}
                >
                  {t(`${i18nPrefix}.actions.convertToOrder`, 'Convert to order')}
                </Button>
              ) : undefined
            }
          />
        </PageBody>
        {ConfirmDialogElement}
      </Page>
    </>
  )
}

export default SimpleDocumentEditor
