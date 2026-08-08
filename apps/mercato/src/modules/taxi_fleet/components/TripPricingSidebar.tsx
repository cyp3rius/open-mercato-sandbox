'use client'

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { formatMoneyDisplay } from '@open-mercato/shared/lib/numeric'
import { MoneyInputField } from '@open-mercato/ui/backend/inputs/MoneyInputField'
import type { TripFormValues } from '../tripFormConfig'

type QuoteSnapshot = {
  currency?: string
  vehicleCategory?: string
  basePrice?: number
  totalPrice?: number
  surcharges?: Array<{ code: string; label: string; amount: number }>
  warnings?: string[]
}

function readQuoteSnapshot(values: Record<string, unknown>): QuoteSnapshot | null {
  const snapshotRaw = typeof values.quoteSnapshotJson === 'string' ? values.quoteSnapshotJson.trim() : ''
  if (!snapshotRaw.length) return null
  try {
    return JSON.parse(snapshotRaw) as QuoteSnapshot
  } catch {
    return null
  }
}

function formatMoney(amount: number, currency: string): string {
  return formatMoneyDisplay(amount, { currency })
}

type TripPricingSidebarProps = {
  values: TripFormValues & Record<string, unknown>
  setFormValue?: (id: string, value: unknown) => void
  disabled?: boolean
  readOnly?: boolean
}

export function TripPricingSidebar({
  values,
  setFormValue,
  disabled = false,
  readOnly = false,
}: TripPricingSidebarProps) {
  const t = useT()
  const snapshot = readQuoteSnapshot(values)
  const currency = snapshot?.currency ?? 'PLN'
  const finalRaw = typeof values.revenueAmount === 'string' ? values.revenueAmount : ''
  const finalAmount = Number(finalRaw)
  const calculatedTotal =
    typeof snapshot?.totalPrice === 'number' && Number.isFinite(snapshot.totalPrice)
      ? snapshot.totalPrice
      : NaN
  const hasCalculated = Number.isFinite(calculatedTotal) && calculatedTotal > 0
  const vehicleCategory =
    values.vehicleCategory === 'standard' || values.vehicleCategory === 'van'
      ? values.vehicleCategory
      : typeof snapshot?.vehicleCategory === 'string'
        ? snapshot.vehicleCategory
        : ''

  const distanceKm = typeof values.distanceKm === 'string' ? values.distanceKm.trim() : ''
  const durationText = typeof values.durationText === 'string' ? values.durationText.trim() : ''

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="text-sm font-medium">
          {t('taxi_fleet.trips.form.finalPrice', 'Final price')}
        </div>
        <MoneyInputField
          value={finalRaw}
          onChange={(next) => setFormValue?.('revenueAmount', next)}
          disabled={disabled}
          readOnly={readOnly}
          currency={currency}
        />
      </div>

      {!hasCalculated ? (
        <p className="text-sm text-muted-foreground">
          {t(
            'taxi_fleet.trips.form.quote.pending',
            'Fill route, schedule, and passengers to calculate the price automatically.',
          )}
        </p>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-medium">{t('taxi_fleet.trips.form.quote.calculated', 'Calculated total')}</span>
            <span className="text-base font-semibold tabular-nums">{formatMoney(calculatedTotal, currency)}</span>
          </div>

          <dl className="space-y-2 border-t pt-3 text-muted-foreground">
            {vehicleCategory ? (
              <div className="flex items-baseline justify-between gap-3">
                <dt>{t('taxi_fleet.trips.form.vehicleCategory', 'Vehicle category')}</dt>
                <dd className="font-medium text-foreground">
                  {t(`taxi_fleet.trips.form.vehicleCategories.${vehicleCategory}`, vehicleCategory)}
                </dd>
              </div>
            ) : null}
            {distanceKm ? (
              <div className="flex items-baseline justify-between gap-3">
                <dt>{t('taxi_fleet.trips.form.distance', 'Distance')}</dt>
                <dd className="tabular-nums text-foreground">
                  {t('taxi_fleet.trips.form.distanceValueKm', '{value} km', { value: distanceKm })}
                </dd>
              </div>
            ) : null}
            {durationText ? (
              <div className="flex items-baseline justify-between gap-3">
                <dt>{t('taxi_fleet.trips.form.durationText', 'Estimated duration')}</dt>
                <dd className="text-foreground">{durationText}</dd>
              </div>
            ) : null}
            {typeof snapshot?.basePrice === 'number' ? (
              <div className="flex items-baseline justify-between gap-3">
                <dt>{t('taxi_fleet.trips.form.quote.base', 'Base fare')}</dt>
                <dd className="tabular-nums text-foreground">{formatMoney(snapshot.basePrice, currency)}</dd>
              </div>
            ) : null}
          </dl>

          {Array.isArray(snapshot?.surcharges) && snapshot.surcharges.length > 0 ? (
            <div className="space-y-2 border-t pt-3">
              <div className="text-sm font-medium text-foreground">
                {t('taxi_fleet.trips.form.quote.surcharges', 'Surcharges')}
              </div>
              <ul className="space-y-1.5 text-muted-foreground">
                {snapshot.surcharges.map((line) => (
                  <li key={line.code} className="flex items-baseline justify-between gap-3">
                    <span>{line.label}</span>
                    <span className="tabular-nums text-foreground">+{formatMoney(line.amount, currency)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {Array.isArray(snapshot?.warnings) && snapshot.warnings.length > 0 ? (
            <ul className="space-y-1 border-t pt-3 text-xs text-amber-700 dark:text-amber-400">
              {snapshot.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}

          {Number.isFinite(finalAmount) && hasCalculated && Math.abs(finalAmount - calculatedTotal) > 0.009 ? (
            <p className="border-t pt-3 text-xs text-muted-foreground">
              {t(
                'taxi_fleet.trips.form.quote.finalDiffers',
                'Final price differs from the calculated total.',
              )}
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
