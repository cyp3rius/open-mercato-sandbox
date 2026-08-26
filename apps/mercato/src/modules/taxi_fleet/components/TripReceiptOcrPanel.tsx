'use client'

import * as React from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { CRUD_FORM_TEXT_INPUT_CLASS } from '@open-mercato/ui/backend/CrudForm'
import { Label } from '@open-mercato/ui/primitives/label'

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

type TripReceiptOcrPanelProps = {
  tripId: string
  canManage: boolean
}

const statusClass: Record<string, string> = {
  pending: 'border-border bg-muted/40 text-muted-foreground',
  processing: 'border-amber-300 bg-amber-50 text-amber-950',
  extracted: 'border-emerald-300 bg-emerald-50 text-emerald-950',
  needs_review: 'border-amber-400 bg-amber-50 text-amber-950',
  failed: 'border-destructive/40 bg-destructive/10 text-destructive',
  applied: 'border-emerald-300 bg-emerald-50 text-emerald-950',
}

function formatWarningLabel(
  t: ReturnType<typeof useT>,
  warning: Record<string, unknown>,
): string {
  const code = String(warning.code ?? '')
  if (code === 'distance_mismatch_trip') {
    return t(
      'taxi_fleet.receiptOcr.warnings.distanceMismatch',
      'Receipt distance differs from route/calculated distance ({route} km → {ocr} km)',
      {
        route: String(warning.driverValue ?? '—'),
        ocr: String(warning.ocrValue ?? '—'),
      },
    )
  }
  return code
}

export function TripReceiptOcrPanel({ tripId, canManage }: TripReceiptOcrPanelProps) {
  const t = useT()
  const [item, setItem] = React.useState<ExtractionItem | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [overwriteValue, setOverwriteValue] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    const call = await apiCall<{ item: ExtractionItem | null }>(
      `/api/taxi_fleet/trips/${encodeURIComponent(tripId)}/receipt-extraction`,
    )
    const next = call.result?.item ?? null
    setItem(next)
    setOverwriteValue(next?.appliedDocumentNumber || next?.ocrDocumentNumber || next?.driverDocumentNumber || '')
    setLoading(false)
  }, [tripId])

  React.useEffect(() => {
    void load()
  }, [load])

  const runAction = async (action: 'retry' | 'overwrite') => {
    setBusy(true)
    try {
      const call = await apiCall<{ item: ExtractionItem }>(
        `/api/taxi_fleet/trips/${encodeURIComponent(tripId)}/receipt-extraction`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(
            action === 'overwrite'
              ? { action, documentNumber: overwriteValue }
              : { action },
          ),
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

  if (loading) {
    return (
      <section className="mt-6 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
        {t('taxi_fleet.receiptOcr.loading', 'Loading receipt OCR…')}
      </section>
    )
  }

  if (!item) {
    return (
      <section className="mt-6 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
        {t('taxi_fleet.receiptOcr.empty', 'No receipt OCR for this trip yet.')}
      </section>
    )
  }

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
            <li key={`${String(warning.code)}-${index}`}>{formatWarningLabel(t, warning)}</li>
          ))}
        </ul>
      ) : null}
      {item.errorMessage ? <p className="text-xs text-destructive">{item.errorMessage}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" asChild>
          <a href={item.attachmentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2">
            <ExternalLink className="size-3.5" aria-hidden />
            {t('taxi_fleet.receiptOcr.openDocument', 'Open document')}
          </a>
        </Button>
        {canManage ? (
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void runAction('retry')}>
            <RefreshCw className="mr-2 size-3.5" aria-hidden />
            {t('taxi_fleet.receiptOcr.retry', 'Retry OCR')}
          </Button>
        ) : null}
      </div>

      {canManage ? (
        <div className="space-y-2 border-t pt-3">
          <Label htmlFor="receipt-ocr-overwrite" className="text-sm font-medium">
            {t('taxi_fleet.receiptOcr.overwriteLabel', 'Overwrite document number')}
          </Label>
          <div className="flex flex-wrap gap-2">
            <input
              id="receipt-ocr-overwrite"
              value={overwriteValue}
              onChange={(event) => setOverwriteValue(event.target.value)}
              className={`${CRUD_FORM_TEXT_INPUT_CLASS} max-w-sm`}
              disabled={busy}
            />
            <Button type="button" disabled={busy || !overwriteValue.trim()} onClick={() => void runAction('overwrite')}>
              {t('taxi_fleet.receiptOcr.overwrite', 'Save overwrite')}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
