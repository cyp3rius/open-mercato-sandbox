'use client'

import * as React from 'react'
import { ExternalLink, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { Button } from '@open-mercato/ui/primitives/button'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { Separator } from '@open-mercato/ui/primitives/separator'
import { formatReceiptOcrWarningLabel } from '../lib/receiptOcrWarningLabel'
import { useTaxiFleetPermissions } from './useTaxiFleetPermissions'

type ExtractionItem = {
  id: string
  attachmentId: string
  status: string
  driverDocumentNumber: string | null
  ocrDocumentNumber: string | null
  ocrGrossAmount: string | null
  ocrVatRatePercent: string | null
  ocrBuyerNip: string | null
  ocrSellerNip: string | null
  ocrRegistrationPlate: string | null
  appliedDocumentNumber: string | null
  confidence: string | null
  warnings: Array<Record<string, unknown>>
  errorMessage: string | null
  attachmentUrl: string
  resolvedCompanyId: string | null
  entryAmount?: string | null
  entryVatRatePercent?: string | null
  entryDocumentNumber?: string | null
  entryCustomerCompanyId?: string | null
  entryResourceId?: string | null
}

type ApplyField = 'amount' | 'documentNumber' | 'vatRatePercent'

type ExpenseReceiptOcrPanelProps = {
  entryId: string | null
  canManage: boolean
  onApplied?: (item: ExtractionItem) => void
  /** Called after cost + OCR + storage file were permanently deleted. */
  onPurged?: () => void
}

const statusClass: Record<string, string> = {
  pending: 'border-border bg-muted/40 text-muted-foreground',
  processing: 'border-amber-300 bg-amber-50 text-amber-950',
  extracted: 'border-emerald-300 bg-emerald-50 text-emerald-950',
  needs_review: 'border-amber-400 bg-amber-50 text-amber-950',
  failed: 'border-destructive/40 bg-destructive/10 text-destructive',
  applied: 'border-emerald-300 bg-emerald-50 text-emerald-950',
}

const buttonGroupClass =
  'inline-flex flex-wrap overflow-hidden rounded-md border border-border divide-x divide-border'

const groupButtonClass =
  'h-8 rounded-none border-0 shadow-none px-2.5 text-xs font-medium'

function hasFieldConflict(item: ExtractionItem, field: string): boolean {
  return (item.warnings ?? []).some((warning) => {
    const code = String(warning.code ?? '')
    return code === 'field_conflict' && String(warning.field ?? '') === field
  })
}

export function ExpenseReceiptOcrPanel({
  entryId,
  canManage,
  onApplied,
  onPurged,
}: ExpenseReceiptOcrPanelProps) {
  const t = useT()
  const { canPurgeReceipts } = useTaxiFleetPermissions()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [item, setItem] = React.useState<ExtractionItem | null>(null)
  const [loading, setLoading] = React.useState(Boolean(entryId))
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!entryId) {
      setItem(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const call = await apiCall<{ item: ExtractionItem | null }>(
      `/api/taxi_fleet/financial-entries/${encodeURIComponent(entryId)}/receipt-extraction`,
    )
    setItem(call.result?.item ?? null)
    setLoading(false)
  }, [entryId])

  React.useEffect(() => {
    void load()
  }, [load])

  React.useEffect(() => {
    if (!entryId || !item) return
    if (item.status !== 'pending' && item.status !== 'processing') return
    const timer = window.setTimeout(() => {
      void load()
    }, 2500)
    return () => window.clearTimeout(timer)
  }, [entryId, item, load])

  const runRetry = async () => {
    if (!entryId) return
    setBusy(true)
    try {
      const call = await apiCall<{ item: ExtractionItem }>(
        `/api/taxi_fleet/financial-entries/${encodeURIComponent(entryId)}/receipt-extraction`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'retry' }),
        },
      )
      if (!call.ok || !call.result?.item) {
        flash(t('taxi_fleet.receiptOcr.actionFailed', 'Could not update receipt OCR.'), 'error')
        return
      }
      setItem(call.result.item)
      flash(t('taxi_fleet.receiptOcr.actionSuccess', 'Receipt OCR updated.'), 'success')
    } finally {
      setBusy(false)
    }
  }

  const applyField = async (field: ApplyField) => {
    if (!entryId) return
    setBusy(true)
    try {
      const call = await apiCall<{ item: ExtractionItem; error?: string }>(
        `/api/taxi_fleet/financial-entries/${encodeURIComponent(entryId)}/receipt-extraction`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'apply_field', field }),
        },
      )
      if (!call.ok || !call.result?.item) {
        flash(
          (typeof call.result?.error === 'string' && call.result.error) ||
            t('taxi_fleet.receiptOcr.actionFailed', 'Could not update receipt OCR.'),
          'error',
        )
        return
      }
      setItem(call.result.item)
      flash(t('taxi_fleet.receiptOcr.applySuccess', 'Form updated from OCR.'), 'success')
      onApplied?.(call.result.item)
    } finally {
      setBusy(false)
    }
  }

  const runPurge = async () => {
    if (!entryId || !canPurgeReceipts) return
    const ok = await confirm({
      title: t(
        'taxi_fleet.receiptOcr.purgeExpenseConfirmTitle',
        'Delete cost, receipt and OCR?',
      ),
      text: t(
        'taxi_fleet.receiptOcr.purgeExpenseConfirmDescription',
        'This permanently deletes the cost entry, OCR result and the receipt file from storage (including Google Drive). This cannot be undone.',
      ),
      variant: 'destructive',
    })
    if (!ok) return
    setBusy(true)
    try {
      const call = await apiCall<{ ok?: boolean; error?: string }>(
        `/api/taxi_fleet/financial-entries/${encodeURIComponent(entryId)}/receipt`,
        { method: 'DELETE' },
      )
      if (!call.ok) {
        flash(
          (typeof call.result?.error === 'string' && call.result.error) ||
            t('taxi_fleet.receiptOcr.purgeFailed', 'Could not delete receipt and OCR.'),
          'error',
        )
        return
      }
      flash(
        t('taxi_fleet.receiptOcr.purgeExpenseSuccess', 'Cost, receipt and OCR deleted.'),
        'success',
      )
      setItem(null)
      onPurged?.()
    } finally {
      setBusy(false)
    }
  }

  if (!entryId) {
    return (
      <section className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        {t(
          'taxi_fleet.receiptOcr.expenseSaveFirst',
          'Save the cost to see OCR status and apply extracted fields.',
        )}
      </section>
    )
  }

  if (loading) {
    return (
      <section className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
        {t('taxi_fleet.receiptOcr.loading', 'Loading receipt OCR…')}
      </section>
    )
  }

  if (!item) {
    return (
      <section className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
        {t('taxi_fleet.receiptOcr.emptyExpense', 'No receipt OCR for this cost yet. Upload an attachment.')}
      </section>
    )
  }

  const showOverwrite =
    canManage &&
    (Boolean(item.ocrGrossAmount) ||
      Boolean(item.ocrDocumentNumber?.trim()) ||
      Boolean(item.ocrVatRatePercent))

  return (
    <section className="space-y-3 rounded-lg border bg-card px-4 py-3">
      {ConfirmDialogElement}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t('taxi_fleet.receiptOcr.title', 'Receipt / OCR')}</h2>
        <Badge variant="outline" className={statusClass[item.status] ?? statusClass.pending}>
          {t(`taxi_fleet.receiptOcr.statuses.${item.status}`, item.status)}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 text-sm">
          <div className="text-xs text-muted-foreground">
            {t('taxi_fleet.receiptOcr.appliedNumber', 'Applied document number')}
          </div>
          <div className="font-medium tabular-nums">{item.appliedDocumentNumber || '—'}</div>
        </div>
        <div className="space-y-1 text-sm">
          <div className="text-xs text-muted-foreground">{t('taxi_fleet.receiptOcr.ocrNumber', 'OCR number')}</div>
          <div className="font-medium tabular-nums">{item.ocrDocumentNumber || '—'}</div>
        </div>
        <div className="space-y-1 text-sm">
          <div className="text-xs text-muted-foreground">{t('taxi_fleet.receiptOcr.amount', 'OCR amount')}</div>
          <div className="font-medium tabular-nums whitespace-nowrap">
            {item.ocrGrossAmount != null ? `${item.ocrGrossAmount} PLN` : '—'}
          </div>
        </div>
        <div className="space-y-1 text-sm">
          <div className="text-xs text-muted-foreground">{t('taxi_fleet.receiptOcr.vatRate', 'OCR VAT')}</div>
          <div className="font-medium tabular-nums">
            {item.ocrVatRatePercent != null ? `${item.ocrVatRatePercent}%` : '—'}
          </div>
        </div>
        <div className="space-y-1 text-sm">
          <div className="text-xs text-muted-foreground">{t('taxi_fleet.receiptOcr.sellerNip', 'Issuer NIP')}</div>
          <div className="font-medium tabular-nums">{item.ocrSellerNip || '—'}</div>
        </div>
        <div className="space-y-1 text-sm">
          <div className="text-xs text-muted-foreground">{t('taxi_fleet.receiptOcr.buyerNip', 'Buyer NIP')}</div>
          <div className="font-medium tabular-nums">{item.ocrBuyerNip || '—'}</div>
        </div>
        <div className="space-y-1 text-sm">
          <div className="text-xs text-muted-foreground">
            {t('taxi_fleet.receiptOcr.registrationPlate', 'OCR registration plate')}
          </div>
          <div className="font-medium tabular-nums">{item.ocrRegistrationPlate || '—'}</div>
        </div>
        <div className="space-y-1 text-sm">
          <div className="text-xs text-muted-foreground">{t('taxi_fleet.receiptOcr.confidence', 'Confidence')}</div>
          <div className="font-medium tabular-nums">{item.confidence ?? '—'}</div>
        </div>
      </div>

      {item.warnings?.filter((warning) => String(warning.code ?? '') !== 'polcard_payment_confirmation')
        .length ? (
        <ul className="list-disc space-y-1 pl-5 text-xs text-amber-800">
          {item.warnings
            .filter((warning) => String(warning.code ?? '') !== 'polcard_payment_confirmation')
            .map((warning, index) => (
            <li key={`${String(warning.code)}-${String(warning.field ?? '')}-${index}`}>
              {formatReceiptOcrWarningLabel(t, warning)}
            </li>
          ))}
        </ul>
      ) : null}
      {item.errorMessage ? <p className="text-xs text-destructive">{item.errorMessage}</p> : null}

      <Separator />

      <div className="space-y-2">
        <div className="text-xs font-medium">{t('taxi_fleet.receiptOcr.receiptActions', 'Receipt')}</div>
        <div className="flex flex-wrap items-center gap-2">
          <div className={buttonGroupClass}>
            <Button type="button" variant="ghost" size="sm" className={groupButtonClass} asChild>
              <a
                href={item.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center"
              >
                <ExternalLink className="mr-1.5 size-3.5" aria-hidden />
                {t('taxi_fleet.receiptOcr.openDocument', 'Open')}
              </a>
            </Button>
            {canManage ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={groupButtonClass}
                disabled={busy}
                onClick={() => void runRetry()}
              >
                {busy ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="mr-1.5 size-3.5" aria-hidden />
                )}
                {t('taxi_fleet.receiptOcr.retry', 'Retry OCR')}
              </Button>
            ) : null}
          </div>
          {canPurgeReceipts ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-8 px-2.5 text-xs font-medium"
              disabled={busy}
              onClick={() => void runPurge()}
            >
              <Trash2 className="mr-1.5 size-3.5" aria-hidden />
              {t('taxi_fleet.receiptOcr.purge', 'Delete receipt')}
            </Button>
          ) : null}
        </div>
      </div>

      {showOverwrite ? (
        <>
          <Separator />
          <div className="space-y-2">
            <div className="text-xs font-medium">
              {t('taxi_fleet.receiptOcr.overwriteActions', 'Overwrite')}
            </div>
            <div className={buttonGroupClass}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={`${groupButtonClass}${hasFieldConflict(item, 'amount') ? ' bg-amber-50 text-amber-950' : ''}`}
                disabled={busy || !item.ocrGrossAmount}
                onClick={() => void applyField('amount')}
              >
                {t('taxi_fleet.receiptOcr.applyAmount', 'Amount')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={`${groupButtonClass}${hasFieldConflict(item, 'vatRatePercent') ? ' bg-amber-50 text-amber-950' : ''}`}
                disabled={busy || !item.ocrVatRatePercent}
                onClick={() => void applyField('vatRatePercent')}
              >
                {t('taxi_fleet.receiptOcr.applyVat', 'VAT')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={`${groupButtonClass}${hasFieldConflict(item, 'documentNumber') ? ' bg-amber-50 text-amber-950' : ''}`}
                disabled={busy || !item.ocrDocumentNumber?.trim()}
                onClick={() => void applyField('documentNumber')}
              >
                {t('taxi_fleet.receiptOcr.applyDocumentNumber', 'Document number')}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t(
                'taxi_fleet.receiptOcr.overwriteHint',
                'One click replaces the form value with OCR and saves.',
              )}
            </p>
          </div>
        </>
      ) : null}
    </section>
  )
}
