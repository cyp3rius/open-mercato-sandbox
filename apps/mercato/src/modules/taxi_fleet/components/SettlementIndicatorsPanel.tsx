'use client'

import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { SettlementIndicatorRangeSettings } from '../lib/taxiFleetSettings'
import {
  resolveFuelIndicatorLed,
  resolveRevenueIndicatorLed,
} from '../lib/settlementIndicatorLed'
import { SettlementIndicatorLedValue } from './SettlementIndicatorLedValue'

type SettlementIndicatorsPanelProps = {
  fuelPerKm: number | null
  revenuePerKm: number | null
  totalDistanceKm: string
  fuelRange?: SettlementIndicatorRangeSettings
  revenueRange?: SettlementIndicatorRangeSettings
}

function formatPerKm(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} zł/km`
}

export function SettlementIndicatorsPanel({
  fuelPerKm,
  revenuePerKm,
  totalDistanceKm,
  fuelRange = { min: null, max: null },
  revenueRange = { min: null, max: null },
}: SettlementIndicatorsPanelProps) {
  const t = useT()
  const km = Number(totalDistanceKm)
  const fuelTone = resolveFuelIndicatorLed(fuelPerKm, fuelRange)
  const revenueTone = resolveRevenueIndicatorLed(revenuePerKm, revenueRange)

  return (
    <section className="space-y-3 rounded-lg border bg-card px-4 py-3">
      <h3 className="text-sm font-semibold">
        {t('taxi_fleet.settlements.indicators.title', 'Indicators')}
      </h3>
      <div className="flex flex-wrap gap-3">
        <div className="min-w-35 flex-1 rounded border border-border bg-muted/30 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('taxi_fleet.settlements.indicators.fuelPerKm', 'Fuel')}
          </p>
          <div className="mt-1">
            <SettlementIndicatorLedValue value={formatPerKm(fuelPerKm)} tone={fuelTone} />
          </div>
          {!(km > 0) ? (
            <p className="text-xs text-amber-700">
              {t('taxi_fleet.settlements.indicators.noKm', 'Enter trip km first.')}
            </p>
          ) : null}
        </div>
        <div className="min-w-35 flex-1 rounded border border-border bg-muted/30 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('taxi_fleet.settlements.indicators.revenuePerKm', 'Revenue')}
          </p>
          <div className="mt-1">
            <SettlementIndicatorLedValue value={formatPerKm(revenuePerKm)} tone={revenueTone} />
          </div>
        </div>
      </div>
    </section>
  )
}
