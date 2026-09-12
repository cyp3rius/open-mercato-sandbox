'use client'

import * as React from 'react'
import { ListChecks } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { TAXI_FLEET_COST_TYPES } from '../lib/costTypes'
import { emptySettlementCostBreakdown, type SettlementCostBreakdown } from '../lib/settlementCostsBreakdown'

type SettlementCostsBreakdownPanelProps = {
  costBreakdown: SettlementCostBreakdown
  costsGross: string
  costsNet: string
  titleMode?: 'costs' | 'summary'
  onOpenCostsTab?: () => void
}

function formatMoney(value: string | number): string {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '—'
  return `${parsed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN`
}

export function parseSettlementCostBreakdown(
  snapshotJson?: Record<string, unknown> | null,
): SettlementCostBreakdown {
  const raw = snapshotJson?.costBreakdown
  if (!raw || typeof raw !== 'object') return emptySettlementCostBreakdown()
  const breakdown = emptySettlementCostBreakdown()
  const record = raw as Record<string, { gross?: number; net?: number }>
  for (const costType of [...TAXI_FLEET_COST_TYPES, 'unknown'] as const) {
    const line = record[costType]
    if (!line) continue
    breakdown[costType] = {
      gross: Number(line.gross) || 0,
      net: Number(line.net) || 0,
    }
  }
  return breakdown
}

export function SettlementCostsBreakdownPanel({
  costBreakdown,
  costsGross,
  costsNet,
  titleMode = 'costs',
  onOpenCostsTab,
}: SettlementCostsBreakdownPanelProps) {
  const t = useT()
  const lines = [...TAXI_FLEET_COST_TYPES, 'unknown'] as const
  const titleKey =
    titleMode === 'summary'
      ? 'taxi_fleet.settlements.costs.summaryTitle'
      : 'taxi_fleet.settlements.costs.title'
  const titleFallback = titleMode === 'summary' ? 'Summary' : 'Costs'
  const isSummary = titleMode === 'summary'

  return (
    <section className="space-y-4 rounded-lg border bg-card px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{t(titleKey, titleFallback)}</h3>
          {!isSummary ? (
            <p className="text-sm text-muted-foreground">
              {t(
                'taxi_fleet.settlements.costs.hint',
                'Gross amounts from driver expenses. Net = gross / VAT divisor (default 23%).',
              )}
            </p>
          ) : null}
        </div>
        {onOpenCostsTab ? (
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onOpenCostsTab}>
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
                {t(
                  isSummary ? 'taxi_fleet.settlements.costs.costType' : 'taxi_fleet.settlements.costs.line',
                  isSummary ? 'Cost type' : 'Type',
                )}
              </th>
              <th className="px-3 py-2 font-medium text-right">
                {t(
                  isSummary ? 'taxi_fleet.settlements.costs.value' : 'taxi_fleet.settlements.costs.gross',
                  isSummary ? 'Value' : 'Gross',
                )}
              </th>
              {!isSummary ? (
                <th className="px-3 py-2 font-medium text-right">
                  {t('taxi_fleet.settlements.costs.net', 'Net')}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {lines.map((costType) => {
              const line = costBreakdown[costType]
              if (!line || (line.gross === 0 && line.net === 0)) return null
              return (
                <tr key={costType}>
                  <td className="px-3 py-2">
                    {t(`taxi_fleet.financial.costTypes.${costType}`, costType)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(line.gross)}</td>
                  {!isSummary ? (
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(line.net)}</td>
                  ) : null}
                </tr>
              )
            })}
            {!isSummary ? (
              <>
                <tr className="border-t bg-muted/30 font-semibold">
                  <td className="px-3 py-2">{t('taxi_fleet.settlements.costs.totalGross', 'Total gross')}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(costsGross)}</td>
                  <td className="px-3 py-2" />
                </tr>
                <tr className="font-semibold">
                  <td className="px-3 py-2">{t('taxi_fleet.settlements.costs.totalNet', 'Total net')}</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(costsNet)}</td>
                </tr>
              </>
            ) : null}
          </tbody>
        </table>
      </div>

      {isSummary ? (
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between font-semibold">
            <span>{t('taxi_fleet.settlements.costs.totalGross', 'Total gross')}</span>
            <span className="tabular-nums">{formatMoney(costsGross)}</span>
          </div>
          <div className="flex items-center justify-between font-semibold">
            <span>{t('taxi_fleet.settlements.costs.totalNet', 'Total net')}</span>
            <span className="tabular-nums">{formatMoney(costsNet)}</span>
          </div>
        </div>
      ) : null}
    </section>
  )
}
