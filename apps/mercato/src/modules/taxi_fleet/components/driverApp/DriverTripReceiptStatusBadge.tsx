'use client'

import { AlertTriangle, Check, Loader2 } from 'lucide-react'
import {
  driverBadgeInfoClass,
  driverBadgeNeutralClass,
  driverBadgeSuccessClass,
  driverBadgeWarningClass,
} from './driverUi'
import {
  isTripReceiptProcessing,
  isTripReceiptVerified,
  tripReceiptHasWarnings,
  type DriverTripListExtras,
} from '../../lib/driverTripReceiptStatus'

type Props = {
  item: DriverTripListExtras
  t: (key: string, fallback?: string) => string
}

export function DriverTripReceiptStatusBadge({ item, t }: Props) {
  if (isTripReceiptProcessing(item)) {
    return (
      <span className={`${driverBadgeInfoClass} gap-1`}>
        <Loader2 className="size-3 animate-spin" aria-hidden />
        {t('taxi_fleet.driverApp.trips.processingBadge', 'Processing')}
      </span>
    )
  }

  if (tripReceiptHasWarnings(item) || item.ocrStatus === 'needs_review' || item.ocrStatus === 'failed') {
    return (
      <span className={`${driverBadgeWarningClass} gap-1`}>
        <AlertTriangle className="size-3" aria-hidden />
        {t('taxi_fleet.driverApp.trips.needsReviewBadge', 'Needs review')}
      </span>
    )
  }

  if (isTripReceiptVerified(item)) {
    return (
      <span className={`${driverBadgeSuccessClass} gap-1`}>
        <Check className="size-3" aria-hidden />
        {t('taxi_fleet.driverApp.trips.verifiedBadge', 'Verified')}
      </span>
    )
  }

  if (!item.receiptAttachmentId) {
    return (
      <span className={driverBadgeNeutralClass}>
        {t('taxi_fleet.driverApp.trips.noReceiptBadge', 'No receipt')}
      </span>
    )
  }

  return null
}

export function tripListHasProcessingReceipt(items: DriverTripListExtras[]): boolean {
  return items.some((item) => isTripReceiptProcessing(item))
}
