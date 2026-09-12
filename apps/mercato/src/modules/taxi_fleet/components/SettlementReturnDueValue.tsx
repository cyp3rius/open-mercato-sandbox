'use client'

import { formatSettlementMoney } from '../lib/settlementPayoutDisplay'

type SettlementReturnDueValueProps = {
  amount: number | null | undefined
  align?: 'left' | 'right'
}

export function SettlementReturnDueValue({ amount, align = 'right' }: SettlementReturnDueValueProps) {
  const parsed = Number(amount ?? 0)
  const hasReturn = Number.isFinite(parsed) && parsed > 0.005
  const justifyClass = align === 'right' ? 'justify-end' : 'justify-start'

  return (
    <div className={`flex whitespace-nowrap tabular-nums ${justifyClass}`}>
      <span className="inline-flex items-center gap-2">
        {hasReturn ? (
          <span
            className="size-2 shrink-0 rounded-full bg-destructive shadow-[0_0_6px_1px] shadow-destructive/60"
            aria-hidden
          />
        ) : null}
        <span>{formatSettlementMoney(parsed)}</span>
      </span>
    </div>
  )
}
