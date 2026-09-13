'use client'

import { AlertTriangle, Check, Loader2 } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import {
  isTripReceiptProcessing,
  isTripReceiptVerified,
  tripReceiptHasWarnings,
  type DriverTripListExtras,
} from '../lib/driverTripReceiptStatus'

type Props = {
  item: DriverTripListExtras
}

export function TripListOcrIcon({ item }: Props) {
  const t = useT()

  if (isTripReceiptProcessing(item)) {
    return (
      <span
        className="inline-flex text-sky-600"
        title={t('taxi_fleet.trips.list.ocr.processing', 'OCR processing')}
      >
        <Loader2 className="size-4 animate-spin" aria-hidden />
        <span className="sr-only">{t('taxi_fleet.trips.list.ocr.processing', 'OCR processing')}</span>
      </span>
    )
  }

  if (tripReceiptHasWarnings(item) || item.ocrStatus === 'needs_review' || item.ocrStatus === 'failed') {
    return (
      <span
        className="inline-flex text-amber-600"
        title={t('taxi_fleet.trips.list.ocr.needsReview', 'OCR needs review')}
      >
        <AlertTriangle className="size-4" aria-hidden />
        <span className="sr-only">{t('taxi_fleet.trips.list.ocr.needsReview', 'OCR needs review')}</span>
      </span>
    )
  }

  if (isTripReceiptVerified(item)) {
    return (
      <span
        className="inline-flex text-emerald-600"
        title={t('taxi_fleet.trips.list.ocr.verified', 'OCR verified')}
      >
        <Check className="size-4" aria-hidden />
        <span className="sr-only">{t('taxi_fleet.trips.list.ocr.verified', 'OCR verified')}</span>
      </span>
    )
  }

  return <span className="text-muted-foreground">—</span>
}
