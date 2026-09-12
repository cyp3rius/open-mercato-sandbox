'use client'

import { Check, Loader2 } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Badge } from '@open-mercato/ui/primitives/badge'
import {
  expenseHasWarnings,
  isExpenseOcrProcessing,
  isExpenseOcrVerified,
  type ExpenseReceiptOcrFields,
} from '../lib/driverExpenses'

type Props = {
  item: ExpenseReceiptOcrFields
}

export function SettlementExpenseReceiptOcrBadge({ item }: Props) {
  const t = useT()

  if (item.isDocumentDuplicate) {
    return (
      <Badge variant="outline" className="gap-1 border-rose-400 bg-rose-50 font-normal text-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
        {t('taxi_fleet.settlements.receipt.duplicateBadge', 'Duplicate receipt')}
      </Badge>
    )
  }

  if (expenseHasWarnings(item)) return null

  if (isExpenseOcrProcessing(item)) {
    return (
      <Badge variant="outline" className="gap-1 border-sky-400 bg-sky-50 font-normal text-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
        <Loader2 className="size-3 animate-spin" aria-hidden />
        {t('taxi_fleet.settlements.receipt.processingBadge', 'Processing')}
      </Badge>
    )
  }

  if (isExpenseOcrVerified(item)) {
    return (
      <Badge variant="outline" className="gap-1 border-emerald-400 bg-emerald-50 font-normal text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
        <Check className="size-3" aria-hidden />
        {t('taxi_fleet.settlements.receipt.verifiedBadge', 'Verified')}
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="font-normal text-muted-foreground">
      {t('taxi_fleet.settlements.receipt.noReceiptBadge', 'No receipt')}
    </Badge>
  )
}
