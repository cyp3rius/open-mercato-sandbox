'use client'

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { MoneyInputField } from '@open-mercato/ui/backend/inputs/MoneyInputField'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { buildQuoteInputFromTripForm } from '../../lib/pricing/tripFormQuote'
import type { TripFormValues } from '../tripFormConfig'

const QUOTE_DEBOUNCE_MS = 500

type QuoteApiResponse = {
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

export function TripQuoteSync({ values, setFormValue, disabled = false }: TripQuoteSyncProps) {
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  const abortRef = React.useRef<AbortController | null>(null)
  const requestIdRef = React.useRef(0)
  /** Last final price we wrote from a quote; used so manual overrides are not overwritten. */
  const lastAutoRevenueRef = React.useRef<string | null>(null)
  const revenueAmountRef = React.useRef(values.revenueAmount)
  revenueAmountRef.current = values.revenueAmount

  const quoteInput = React.useMemo(() => buildQuoteInputFromTripForm(values as TripFormValues), [values])

  React.useEffect(() => {
    if (!setFormValue || disabled) return

    clearTimeout(debounceRef.current)
    abortRef.current?.abort()

    if (!quoteInput) {
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
          const call = await apiCall<QuoteApiResponse>(
            '/api/taxi_fleet/quote',
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

          const quotedTotal = String(data.totalPrice)
          const currentRevenue = String(revenueAmountRef.current ?? '').trim()
          const shouldSyncFinalPrice =
            !currentRevenue ||
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
          const currentCategory =
            values.vehicleCategory === 'standard' || values.vehicleCategory === 'van'
              ? values.vehicleCategory
              : ''
          if (!currentCategory && typeof data.vehicleCategory === 'string' && data.vehicleCategory.length) {
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
  }, [disabled, quoteInput, setFormValue, values.vehicleCategory])

  return null
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
