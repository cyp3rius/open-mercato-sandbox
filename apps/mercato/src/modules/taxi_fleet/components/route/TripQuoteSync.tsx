'use client'

import * as React from 'react'
import { parseNumericValue } from '@open-mercato/shared/lib/numeric'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { MoneyInputField } from '@open-mercato/ui/backend/inputs/MoneyInputField'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { buildQuoteInputFromTripForm } from '../../lib/pricing/tripFormQuote'
import { tripHasAppliedDiscount } from '../../lib/tripDiscount'
import type { TripFormValues } from '../tripFormConfig'

const QUOTE_DEBOUNCE_MS = 500

export type QuoteApiResponse = {
  currency?: string
  vehicleCategory?: string
  basePrice?: number
  totalPrice?: number
  surcharges?: Array<{ code: string; label: string; amount: number }>
  warnings?: string[]
  error?: string
  code?: string
}

type TripQuoteSyncProps = {
  values: TripFormValues & Record<string, unknown>
  setFormValue?: (id: string, value: unknown) => void
  disabled?: boolean
}

function isBlankOrZeroRevenue(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed.length) return true
  const parsed = parseNumericValue(trimmed)
  return parsed !== null && parsed === 0
}

function formatQuotedTotal(totalPrice: number): string {
  return totalPrice.toFixed(2)
}

function quoteFingerprint(values: TripFormValues): string | null {
  const input = buildQuoteInputFromTripForm(values)
  return input ? JSON.stringify(input) : null
}

/**
 * Auto-fills final price from fleet pricing when empty / still matching last auto quote.
 * Manual edits are preserved until the user clicks Recalculate.
 */
export function TripQuoteSync({ values, setFormValue, disabled = false }: TripQuoteSyncProps) {
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  const abortRef = React.useRef<AbortController | null>(null)
  const requestIdRef = React.useRef(0)
  /** Last final price we wrote from a quote; used so manual overrides are not overwritten. */
  const lastAutoRevenueRef = React.useRef<string | null>(null)
  const revenueAmountRef = React.useRef(values.revenueAmount)
  revenueAmountRef.current = values.revenueAmount

  const fingerprint = quoteFingerprint(values as TripFormValues)

  React.useEffect(() => {
    if (!setFormValue || disabled) return
    // Discount code locked the inject total — do not overwrite final price or snapshot.
    if (tripHasAppliedDiscount(values as TripFormValues)) return

    clearTimeout(debounceRef.current)
    abortRef.current?.abort()

    if (!fingerprint) {
      setFormValue('basePrice', '')
      setFormValue('quoteSnapshotJson', '')
      return
    }

    debounceRef.current = setTimeout(() => {
      const requestId = ++requestIdRef.current
      const controller = new AbortController()
      abortRef.current = controller

      void (async () => {
        try {
          const quoteInput = JSON.parse(fingerprint) as ReturnType<typeof buildQuoteInputFromTripForm>
          if (!quoteInput) return

          const call = await apiCall<QuoteApiResponse>(
            '/api/taxi_fleet/pricing/quote',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(quoteInput),
              signal: controller.signal,
            },
            { fallback: {} },
          )

          if (requestId !== requestIdRef.current) return

          const data = call.result ?? {}
          if (!call.ok || typeof data.totalPrice !== 'number') {
            setFormValue('quoteSnapshotJson', '')
            return
          }

          const snapshot = {
            currency: data.currency ?? 'PLN',
            vehicleCategory: data.vehicleCategory,
            basePrice: data.basePrice,
            surcharges: data.surcharges ?? [],
            totalPrice: data.totalPrice,
            ...(Array.isArray(data.warnings) && data.warnings.length ? { warnings: data.warnings } : {}),
          }

          const quotedTotal = formatQuotedTotal(data.totalPrice)
          const currentRevenue = String(revenueAmountRef.current ?? '').trim()
          const shouldSyncFinalPrice =
            isBlankOrZeroRevenue(currentRevenue) ||
            currentRevenue === lastAutoRevenueRef.current ||
            currentRevenue === quotedTotal

          setFormValue('basePrice', String(data.basePrice ?? ''))
          if (shouldSyncFinalPrice) {
            if (currentRevenue !== quotedTotal) {
              setFormValue('revenueAmount', quotedTotal)
            }
            lastAutoRevenueRef.current = quotedTotal
          }
          setFormValue('quoteSnapshotJson', JSON.stringify(snapshot))
          if (data.vehicleCategory === 'standard' || data.vehicleCategory === 'van') {
            setFormValue('vehicleCategory', data.vehicleCategory)
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return
        } finally {
          if (requestId === requestIdRef.current) {
            abortRef.current = null
          }
        }
      })()
    }, QUOTE_DEBOUNCE_MS)

    return () => {
      clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    }
  }, [disabled, fingerprint, setFormValue, values.discountJson])

  return null
}

/**
 * Forces a quote refresh and writes the result into final price (overrides manual edits).
 */
export async function recalculateTripFinalPrice(params: {
  values: TripFormValues
  setFormValue: (id: string, value: unknown) => void
  signal?: AbortSignal
}): Promise<
  | { ok: true; totalPrice: number }
  | { ok: false; reason: 'incomplete' | 'failed' | 'discount_locked' }
> {
  if (tripHasAppliedDiscount(params.values)) {
    return { ok: false, reason: 'discount_locked' }
  }
  const quoteInput = buildQuoteInputFromTripForm(params.values)
  if (!quoteInput) return { ok: false, reason: 'incomplete' }

  try {
    const call = await apiCall<QuoteApiResponse>(
      '/api/taxi_fleet/pricing/quote',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quoteInput),
        signal: params.signal,
      },
      { fallback: {} },
    )
    const data = call.result ?? {}
    if (!call.ok || typeof data.totalPrice !== 'number') {
      return { ok: false, reason: 'failed' }
    }

    const quotedTotal = formatQuotedTotal(data.totalPrice)
    const snapshot = {
      currency: data.currency ?? 'PLN',
      vehicleCategory: data.vehicleCategory,
      basePrice: data.basePrice,
      surcharges: data.surcharges ?? [],
      totalPrice: data.totalPrice,
      ...(Array.isArray(data.warnings) && data.warnings.length ? { warnings: data.warnings } : {}),
    }
    params.setFormValue('basePrice', String(data.basePrice ?? ''))
    params.setFormValue('revenueAmount', quotedTotal)
    params.setFormValue('quoteSnapshotJson', JSON.stringify(snapshot))
    if (data.vehicleCategory === 'standard' || data.vehicleCategory === 'van') {
      params.setFormValue('vehicleCategory', data.vehicleCategory)
    }
    return { ok: true, totalPrice: data.totalPrice }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, reason: 'failed' }
    }
    return { ok: false, reason: 'failed' }
  }
}

type TripQuoteAmountFieldProps = {
  values: Record<string, unknown>
}

function readQuoteSnapshot(values: Record<string, unknown>): QuoteApiResponse | null {
  const snapshotRaw = typeof values.quoteSnapshotJson === 'string' ? values.quoteSnapshotJson.trim() : ''
  if (!snapshotRaw.length) return null
  try {
    return JSON.parse(snapshotRaw) as QuoteApiResponse
  } catch {
    return null
  }
}

export function TripQuoteAmountField({ values }: TripQuoteAmountFieldProps) {
  const t = useT()
  const parsed = readQuoteSnapshot(values)
  const totalPrice = parsed?.totalPrice ?? (values.revenueAmount ? Number(values.revenueAmount) : NaN)
  const currency = parsed?.currency ?? 'PLN'
  const hasPrice = Number.isFinite(totalPrice) && totalPrice > 0

  return (
    <MoneyInputField
      value={hasPrice ? totalPrice.toFixed(2) : ''}
      readOnly
      currency={currency}
      placeholder={t(
        'taxi_fleet.trips.form.quote.pendingShort',
        'Calculated automatically',
      )}
    />
  )
}

type TripQuoteSummaryProps = {
  values: TripFormValues & Record<string, unknown>
}

function formatMoney(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`
}

export function TripQuoteSummary({ values }: TripQuoteSummaryProps) {
  const t = useT()

  const parsed = readQuoteSnapshot(values)

  const totalPrice = parsed?.totalPrice ?? (values.revenueAmount ? Number(values.revenueAmount) : NaN)
  const currency = parsed?.currency ?? 'PLN'

  if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t(
          'taxi_fleet.trips.form.quote.pending',
          'Fill route, schedule, and passengers to calculate the price automatically.',
        )}
      </p>
    )
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-4 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium">{t('taxi_fleet.trips.form.quote.total', 'Total price')}</span>
        <span className="text-lg font-semibold tabular-nums">{formatMoney(totalPrice, currency)}</span>
      </div>
      {typeof parsed?.basePrice === 'number' ? (
        <div className="flex items-baseline justify-between gap-3 text-muted-foreground">
          <span>{t('taxi_fleet.trips.form.quote.base', 'Base fare')}</span>
          <span className="tabular-nums">{formatMoney(parsed.basePrice, currency)}</span>
        </div>
      ) : null}
      {Array.isArray(parsed?.surcharges) && parsed.surcharges.length > 0 ? (
        <ul className="space-y-1 border-t pt-2 text-muted-foreground">
          {parsed.surcharges.map((line) => (
            <li key={line.code} className="flex items-baseline justify-between gap-3">
              <span>{line.label}</span>
              <span className="tabular-nums">+{formatMoney(line.amount, currency)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
