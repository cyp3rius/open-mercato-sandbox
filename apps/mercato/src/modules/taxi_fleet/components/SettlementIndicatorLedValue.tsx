'use client'

import type { SettlementIndicatorLedTone } from '../lib/settlementIndicatorLed'

const toneClass: Record<SettlementIndicatorLedTone, string> = {
  red: 'bg-destructive shadow-[0_0_6px_1px] shadow-destructive/60',
  yellow: 'bg-amber-400 shadow-[0_0_6px_1px] shadow-amber-400/60',
  green: 'bg-emerald-500 shadow-[0_0_6px_1px] shadow-emerald-500/60',
}

const neutralLedClass = 'bg-muted-foreground/40 shadow-[0_0_4px_1px] shadow-muted-foreground/30'

type SettlementIndicatorLedValueProps = {
  value: string
  tone: SettlementIndicatorLedTone | null
}

export function SettlementIndicatorLedValue({ value, tone }: SettlementIndicatorLedValueProps) {
  return (
    <div className="flex items-center justify-start gap-2">
      <span
        className={`size-2 shrink-0 rounded-full ${tone ? toneClass[tone] : neutralLedClass}`}
        aria-hidden
      />
      <span className="whitespace-nowrap text-lg font-semibold tabular-nums">{value}</span>
    </div>
  )
}
