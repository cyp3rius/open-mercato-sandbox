'use client'

import * as React from 'react'
import { ListChecks } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import {
  SETTLEMENT_REVENUE_LINE_KEYS,
  emptySettlementRevenueBreakdown,
  type SettlementRevenueBreakdown,
} from '../lib/settlementRevenueBreakdown'

type SettlementRevenueBreakdownPanelProps = {
  breakdown: SettlementRevenueBreakdown
  revenueGross: string
  revenueNet: string
  titleMode?: 'revenue' | 'summary'
  onOpenTripsTab?: () => void
}

function formatMoney(value: string | number): string {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '—'
  return `${parsed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN`
}

export function SettlementRevenueBreakdownPanel({
  breakdown,
  revenueGross,
  revenueNet,
  titleMode = 'revenue',
  onOpenTripsTab,
}: SettlementRevenueBreakdownPanelProps) {
  const t = useT()
  const lines = breakdown ?? emptySettlementRevenueBreakdown()
  const isSummary = titleMode === 'summary'
  const titleKey =
    isSummary ? 'taxi_fleet.settlements.revenue.summaryTitle' : 'taxi_fleet.settlements.revenue.title'
  const titleFallback = isSummary ? 'Summary' : 'Revenue'

  return (
    <section className="space-y-4 rounded-lg border bg-card px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{t(titleKey, titleFallback)}</h3>
          {!isSummary ? (
            <p className="text-sm text-muted-foreground">
              {t(
                'taxi_fleet.settlements.revenue.hint',
                'Gross revenue from completed trips by platform and payment method. Net = gross / 1.08 (VAT 8%).',
              )}
            </p>
          ) : null}
        </div>
        {onOpenTripsTab ? (
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onOpenTripsTab}>
            <ListChecks className="mr-2 size-4 shrink-0" aria-hidden />
            {t('common.open', 'Open')}
          </Button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">
                {t('taxi_fleet.settlements.revenue.line', 'Line')}
              </th>
              <th className="px-3 py-2 font-medium text-right">
                {t(
                  isSummary ? 'taxi_fleet.settlements.revenue.value' : 'taxi_fleet.settlements.revenue.gross',
                  isSummary ? 'Value' : 'Gross',
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {SETTLEMENT_REVENUE_LINE_KEYS.map((key) => {
              if (isSummary && lines[key] === 0) return null
              return (
                <tr key={key}>
                  <td className="px-3 py-2">{t(`taxi_fleet.settlements.revenue.lines.${key}`, key)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(lines[key])}</td>
                </tr>
              )
            })}
            {!isSummary ? (
              <>
                <tr className="border-t bg-muted/30 font-semibold">
                  <td className="px-3 py-2">{t('taxi_fleet.settlements.revenue.totalGross', 'Total gross')}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(revenueGross)}</td>
                </tr>
                <tr className="font-semibold">
                  <td className="px-3 py-2">{t('taxi_fleet.settlements.revenue.totalNet', 'Total net (÷1.08)')}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(revenueNet)}</td>
                </tr>
              </>
            ) : null}
          </tbody>
        </table>
      </div>

      {isSummary ? (
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between font-semibold">
            <span>{t('taxi_fleet.settlements.revenue.totalGross', 'Total gross')}</span>
            <span className="tabular-nums">{formatMoney(revenueGross)}</span>
          </div>
          <div className="flex items-center justify-between font-semibold">
            <span>{t('taxi_fleet.settlements.revenue.totalNet', 'Total net')}</span>
            <span className="tabular-nums">{formatMoney(revenueNet)}</span>
          </div>
        </div>
      ) : null}
    </section>
  )
}
