'use client'

import * as React from 'react'
import { ExternalLink, Loader2, RefreshCw, Upload } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { Separator } from '@open-mercato/ui/primitives/separator'
import { formatReceiptOcrWarningLabel } from '../lib/receiptOcrWarningLabel'

type ExtractionItem = {
  id: string
  attachmentId: string
  status: string
  driverDocumentNumber: string | null
  ocrDocumentNumber: string | null
  ocrGrossAmount: string | null
  ocrDistanceKm: string | null
  ocrBuyerNip: string | null
  appliedDocumentNumber: string | null
  confidence: string | null
  warnings: Array<Record<string, unknown>>
  errorMessage: string | null
  attachmentUrl: string
  tripDistanceKm: string | null
  routeDistanceKm: string | null
  distanceSource: string | null
}

type ApplyField = 'distance' | 'amount' | 'documentNumber'

type TripReceiptOcrPanelProps = {
  tripId: string
  /** Retry OCR / apply OCR fields */
  canManage: boolean
  /** Upload or replace receipt file (unlocked trips / edit-completed) */
  canReplaceReceipt?: boolean
  /** Called after OCR field is applied so the parent form can reload. */
  onApplied?: () => void
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

function hasWarningCode(item: ExtractionItem, code: string): boolean {
  return (item.warnings ?? []).some((warning) => String(warning.code ?? '') === code)
}

function hasAmountConflict(item: ExtractionItem): boolean {
  return (item.warnings ?? []).some((warning) => {
    const code = String(warning.code ?? '')
    const field = String(warning.field ?? '')
    return code === 'amount_mismatch_trip' || (code === 'field_conflict' && field === 'amount')
  })
}

function hasDocumentConflict(item: ExtractionItem): boolean {
  return (item.warnings ?? []).some((warning) => {
    const code = String(warning.code ?? '')
    const field = String(warning.field ?? '')
    return code === 'field_conflict' && field === 'documentNumber'
  })
}

export function TripReceiptOcrPanel({
  tripId,
  canManage,
  canReplaceReceipt = false,
  onApplied,
}: TripReceiptOcrPanelProps) {
  const t = useT()
  const [item, setItem] = React.useState<ExtractionItem | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const fileRef = React.useRef<HTMLInputElement | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    const call = await apiCall<{ item: ExtractionItem | null }>(
      `/api/taxi_fleet/trips/${encodeURIComponent(tripId)}/receipt-extraction`,
    )
    setItem(call.result?.item ?? null)
    setLoading(false)
  }, [tripId])

  React.useEffect(() => {
    void load()
  }, [load])

  const runRetry = async () => {
    setBusy(true)
    try {
      const call = await apiCall<{ item: ExtractionItem }>(
        `/api/taxi_fleet/trips/${encodeURIComponent(tripId)}/receipt-extraction`,
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
    setBusy(true)
    try {
      const call = await apiCall<{ item: ExtractionItem; error?: string }>(
        `/api/taxi_fleet/trips/${encodeURIComponent(tripId)}/receipt-extraction`,
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
      onApplied?.()
    } finally {
      setBusy(false)
    }
  }

  const uploadReceipt = async (file: File) => {
    setBusy(true)
    try {
      const form = new FormData()
      form.set('file', file)
      const call = await apiCall<{ attachmentId?: string; status?: string; error?: string }>(
        `/api/taxi_fleet/trips/${encodeURIComponent(tripId)}/receipt`,
        { method: 'POST', body: form },
      )
      if (!call.ok || !call.result?.attachmentId) {
        flash(
          (typeof call.result?.error === 'string' && call.result.error) ||
            t('taxi_fleet.receiptOcr.uploadFailed', 'Could not upload receipt.'),
          'error',
        )
        return
      }
      const nextStatus = typeof call.result.status === 'string' ? call.result.status : null
      flash(
        nextStatus === 'completed' || nextStatus === 'pending_authorization'
          ? t(
              'taxi_fleet.receiptOcr.uploadCompletedScheduled',
              'Receipt uploaded. Scheduled trip marked as completed.',
            )
          : t('taxi_fleet.receiptOcr.uploadSuccess', 'Receipt uploaded. OCR started.'),
        'success',
      )
      await load()
      onApplied?.()
    } finally {
      setBusy(false)
    }
  }

  const uploadInput = canReplaceReceipt ? (
    <input
      ref={fileRef}
      type="file"
      className="hidden"
      accept="image/*,.pdf,application/pdf"
      onChange={(event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (file) void uploadReceipt(file)
      }}
    />
  ) : null

  if (loading) {
    return (
      <section className="mt-6 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
        {t('taxi_fleet.receiptOcr.loading', 'Loading receipt OCR…')}
      </section>
    )
  }

  if (!item) {
    return (
      <section className="mt-6 space-y-3 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
        <div>{t('taxi_fleet.receiptOcr.empty', 'No receipt OCR for this trip yet.')}</div>
        {uploadInput}
        {canReplaceReceipt ? (
          <div className="space-y-2">
            <div className="text-xs font-medium text-foreground">
              {t('taxi_fleet.receiptOcr.receiptActions', 'Receipt')}
            </div>
            <div className={buttonGroupClass}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={groupButtonClass}
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                {busy ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Upload className="mr-1.5 size-3.5" aria-hidden />
                )}
                {t('taxi_fleet.receiptOcr.upload', 'Upload receipt')}
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    )
  }

  const distanceMismatch = hasWarningCode(item, 'distance_mismatch_trip')
  const amountMismatch = hasAmountConflict(item)
  const showOverwriteSection =
    canManage &&
    (Boolean(item.ocrDistanceKm) ||
      Boolean(item.ocrGrossAmount) ||
      Boolean(item.ocrDocumentNumber?.trim()))

  return (
    <section className="mt-6 space-y-3 rounded-lg border bg-card px-4 py-3">
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
          <div className="text-xs text-muted-foreground">{t('taxi_fleet.receiptOcr.driverNumber', 'Driver number')}</div>
          <div className="font-medium tabular-nums">{item.driverDocumentNumber || '—'}</div>
        </div>
        <div className="space-y-1 text-sm">
          <div className="text-xs text-muted-foreground">{t('taxi_fleet.receiptOcr.amount', 'OCR amount')}</div>
          <div className="font-medium tabular-nums whitespace-nowrap">
            {item.ocrGrossAmount != null ? `${item.ocrGrossAmount} PLN` : '—'}
          </div>
        </div>
        <div className="space-y-1 text-sm">
          <div className="text-xs text-muted-foreground">
            {t('taxi_fleet.receiptOcr.ocrDistance', 'OCR distance')}
          </div>
          <div className="font-medium tabular-nums">
            {item.ocrDistanceKm != null ? `${item.ocrDistanceKm} km` : '—'}
          </div>
        </div>
        <div className="space-y-1 text-sm">
          <div className="text-xs text-muted-foreground">
            {t('taxi_fleet.receiptOcr.tripDistance', 'Trip distance')}
          </div>
          <div className="font-medium tabular-nums">
            {item.tripDistanceKm != null ? `${item.tripDistanceKm} km` : '—'}
          </div>
        </div>
        <div className="space-y-1 text-sm">
          <div className="text-xs text-muted-foreground">
            {t('taxi_fleet.receiptOcr.routeDistance', 'Route distance')}
          </div>
          <div className="font-medium tabular-nums">
            {item.routeDistanceKm != null ? `${item.routeDistanceKm} km` : '—'}
          </div>
        </div>
        {item.distanceSource ? (
          <div className="space-y-1 text-sm">
            <div className="text-xs text-muted-foreground">
              {t('taxi_fleet.receiptOcr.distanceSource', 'Distance source')}
            </div>
            <div className="font-medium">
              {t(`taxi_fleet.receiptOcr.distanceSources.${item.distanceSource}`, item.distanceSource)}
            </div>
          </div>
        ) : null}
        <div className="space-y-1 text-sm">
          <div className="text-xs text-muted-foreground">{t('taxi_fleet.receiptOcr.buyerNip', 'Buyer NIP')}</div>
          <div className="font-medium tabular-nums">{item.ocrBuyerNip || '—'}</div>
        </div>
        <div className="space-y-1 text-sm">
          <div className="text-xs text-muted-foreground">{t('taxi_fleet.receiptOcr.confidence', 'Confidence')}</div>
          <div className="font-medium tabular-nums">{item.confidence ?? '—'}</div>
        </div>
      </div>

      {item.warnings?.length ? (
        <ul className="list-disc space-y-1 pl-5 text-xs text-amber-800">
          {item.warnings.map((warning, index) => (
            <li key={`${String(warning.code)}-${String(warning.field ?? '')}-${index}`}>
              {formatReceiptOcrWarningLabel(t, warning)}
            </li>
          ))}
        </ul>
      ) : null}
      {item.errorMessage ? <p className="text-xs text-destructive">{item.errorMessage}</p> : null}

      <Separator />

      <div className="space-y-2">
        <div className="text-xs font-medium">
          {t('taxi_fleet.receiptOcr.receiptActions', 'Receipt')}
        </div>
        {uploadInput}
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
          {canReplaceReceipt ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={groupButtonClass}
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {busy ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
              ) : (
                <Upload className="mr-1.5 size-3.5" aria-hidden />
              )}
              {t('taxi_fleet.receiptOcr.reupload', 'Upload again')}
            </Button>
          ) : null}
          {canManage ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={groupButtonClass}
              disabled={busy}
              onClick={() => void runRetry()}
            >
              <RefreshCw className="mr-1.5 size-3.5" aria-hidden />
              {t('taxi_fleet.receiptOcr.retry', 'Retry OCR')}
            </Button>
          ) : null}
        </div>
      </div>

      {showOverwriteSection ? (
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
                className={`${groupButtonClass}${distanceMismatch ? ' bg-amber-50 text-amber-950' : ''}`}
                disabled={busy || !item.ocrDistanceKm}
                onClick={() => void applyField('distance')}
              >
                {t('taxi_fleet.receiptOcr.applyDistance', 'Distance')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={`${groupButtonClass}${amountMismatch ? ' bg-amber-50 text-amber-950' : ''}`}
                disabled={busy || !item.ocrGrossAmount}
                onClick={() => void applyField('amount')}
              >
                {t('taxi_fleet.receiptOcr.applyAmount', 'Amount')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={`${groupButtonClass}${hasDocumentConflict(item) ? ' bg-amber-50 text-amber-950' : ''}`}
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
