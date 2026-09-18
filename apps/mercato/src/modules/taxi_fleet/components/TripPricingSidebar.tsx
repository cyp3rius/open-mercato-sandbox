'use client'

import * as React from 'react'
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { formatMoneyDisplay } from '@open-mercato/shared/lib/numeric'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { MoneyInputField } from '@open-mercato/ui/backend/inputs/MoneyInputField'
import { IconButton } from '@open-mercato/ui/primitives/icon-button'
import { recalculateTripFinalPrice } from './route/TripQuoteSync'
import { TripQuoteWarningList } from './TripQuoteWarningList'
import { resolveDiscountCodeDetailHref } from '../lib/discountCodeNav'
import { parseTripDiscountJson, tripHasAppliedDiscount } from '../lib/tripDiscount'
import type { TripFormValues } from './tripFormConfig'

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

type TripFinalPriceInputProps = {
  values: TripFormValues & Record<string, unknown>
  setFormValue?: (id: string, value: unknown) => void
  disabled?: boolean
  readOnly?: boolean
}

export function TripFinalPriceInput({
  values,
  setFormValue,
  disabled = false,
  readOnly = false,
}: TripFinalPriceInputProps) {
  const t = useT()
  const [busy, setBusy] = React.useState(false)
  const snapshot = readQuoteSnapshot(values)
  const currency = snapshot?.currency ?? 'PLN'
  const finalRaw = typeof values.revenueAmount === 'string' ? values.revenueAmount : ''
  const discountLocked = tripHasAppliedDiscount(values)

  async function handleRecalculate() {
    if (!setFormValue || disabled || readOnly || busy || discountLocked) return
    setBusy(true)
    try {
      const result = await recalculateTripFinalPrice({
        values: values as TripFormValues,
        setFormValue,
      })
      if (!result.ok) {
        flash(
          result.reason === 'discount_locked'
            ? t(
                'taxi_fleet.trips.form.quote.discountLocked',
                'Final price is locked because a discount code was applied.',
              )
            : result.reason === 'incomplete'
              ? t(
                  'taxi_fleet.trips.form.quote.pending',
                  'Fill route, schedule, and passengers to calculate the price automatically.',
                )
              : t('taxi_fleet.trips.form.quote.recalculateFailed', 'Could not recalculate the price.'),
          'error',
        )
        return
      }
      flash(t('taxi_fleet.trips.form.quote.recalculated', 'Price recalculated.'), 'success')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-w-0 items-stretch gap-2">
      <MoneyInputField
        className="min-w-0 flex-1"
        value={finalRaw}
        onChange={(next) => setFormValue?.('revenueAmount', next)}
        disabled={disabled || busy}
        readOnly={readOnly}
        currency={currency}
      />
      {!readOnly && !discountLocked ? (
        <IconButton
          type="button"
          variant="outline"
          size="lg"
          className="shrink-0 self-stretch"
          disabled={disabled || busy || !setFormValue}
          aria-label={t('taxi_fleet.trips.form.quote.recalculate', 'Recalculate')}
          title={t('taxi_fleet.trips.form.quote.recalculate', 'Recalculate')}
          onClick={() => void handleRecalculate()}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-4" aria-hidden />
          )}
        </IconButton>
      ) : null}
    </div>
  )
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
  const [openingDiscount, setOpeningDiscount] = React.useState(false)
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
  const discount = parseTripDiscountJson(
    typeof values.discountJson === 'string' ? values.discountJson : '',
  )
  const displayCalculated =
    discount && typeof discount.totalBefore === 'number' && Number.isFinite(discount.totalBefore)
      ? discount.totalBefore
      : calculatedTotal
  const hasCalculatedDisplay = Number.isFinite(displayCalculated) && displayCalculated > 0

  async function handleOpenDiscountCode() {
    if (!discount || openingDiscount) return
    setOpeningDiscount(true)
    try {
      const href = await resolveDiscountCodeDetailHref(discount)
      if (!href) {
        flash(
          t('taxi_fleet.trips.form.quote.discountCodeNotFound', 'Discount code was not found.'),
          'error',
        )
        return
      }
      window.open(href, '_blank', 'noopener,noreferrer')
    } finally {
      setOpeningDiscount(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="text-sm font-medium">
          {t('taxi_fleet.trips.form.finalPrice', 'Final price')}
        </div>
        <TripFinalPriceInput
          values={values}
          setFormValue={setFormValue}
          disabled={disabled}
          readOnly={readOnly}
        />
      </div>

      {!hasCalculatedDisplay && !discount ? (
        <p className="text-sm text-muted-foreground">
          {t(
            'taxi_fleet.trips.form.quote.pending',
            'Fill route, schedule, and passengers to calculate the price automatically.',
          )}
        </p>
      ) : (
        <div className="space-y-3 text-sm">
          {hasCalculatedDisplay ? (
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">
                {discount
                  ? t('taxi_fleet.trips.form.quote.beforeDiscount', 'Total before discount')
                  : t('taxi_fleet.trips.form.quote.calculated', 'Calculated total')}
              </span>
              <span className="text-base font-semibold tabular-nums">
                {formatMoney(displayCalculated, currency)}
              </span>
            </div>
          ) : null}

          {discount ? (
            <dl className="space-y-2 border-t pt-3 text-muted-foreground">
              <div className="flex items-center justify-between gap-3">
                <dt>{t('taxi_fleet.trips.form.quote.discountCode', 'Discount code')}</dt>
                <dd className="flex min-w-0 items-center gap-1.5">
                  <span className="font-mono font-medium text-foreground">{discount.code}</span>
                  <IconButton
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="shrink-0"
                    disabled={openingDiscount}
                    aria-label={t('common.open', 'Open')}
                    title={t('taxi_fleet.trips.form.quote.openDiscountCode', 'Open discount code')}
                    onClick={() => void handleOpenDiscountCode()}
                  >
                    {openingDiscount ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <ExternalLink className="size-3.5" aria-hidden />
                    )}
                  </IconButton>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt>{t('taxi_fleet.trips.form.quote.discountAmount', 'Discount')}</dt>
                <dd className="tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                  −{formatMoney(discount.discountAmount, currency)}
                </dd>
              </div>
              {typeof discount.totalAfter === 'number' && Number.isFinite(discount.totalAfter) ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt>{t('taxi_fleet.trips.form.quote.afterDiscount', 'Total after discount')}</dt>
                  <dd className="tabular-nums font-semibold text-foreground">
                    {formatMoney(discount.totalAfter, currency)}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}

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
            <TripQuoteWarningList warnings={snapshot.warnings} />
          ) : null}

          {discount ? (
            <p className="border-t pt-3 text-xs text-muted-foreground">
              {t(
                'taxi_fleet.trips.form.quote.discountLockedHint',
                'A discount code was applied at booking. Automatic recalculation is disabled.',
              )}
            </p>
          ) : Number.isFinite(finalAmount) &&
            hasCalculated &&
            Math.abs(finalAmount - calculatedTotal) > 0.009 ? (
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
