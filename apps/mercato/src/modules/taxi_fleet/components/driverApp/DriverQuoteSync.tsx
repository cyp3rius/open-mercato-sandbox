'use client'

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { parseNumericValue } from '@open-mercato/shared/lib/numeric'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { buildDriverQuoteInputFromRoute } from '../../lib/pricing/tripFormQuote'
import { driverMutedTextClass } from './driverUi'

const QUOTE_DEBOUNCE_MS = 500

type QuoteApiResponse = {
  currency?: string
  totalPrice?: number
  basePrice?: number
  surcharges?: Array<{ code: string; label: string; amount: number }>
}

function isBlankOrZeroRevenue(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed.length) return true
  const parsed = parseNumericValue(trimmed)
  return parsed !== null && parsed === 0
}

export type DriverQuoteRouteInput = {
  startedAtLocal: string
  distanceKm: string
}

type DriverQuoteSyncProps = {
  route: DriverQuoteRouteInput
  revenueAmount: string
  disabled?: boolean
  onAutoRevenue: (amount: string) => void
}

/**
 * Auto-fills collected payment from fleet pricing when empty / still matching last auto quote.
 */
export function DriverQuoteSync({
  route,
  revenueAmount,
  disabled = false,
  onAutoRevenue,
}: DriverQuoteSyncProps) {
  const t = useT()
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  const abortRef = React.useRef<AbortController | null>(null)
  const requestIdRef = React.useRef(0)
  const lastAutoRevenueRef = React.useRef<string | null>(null)
  const revenueAmountRef = React.useRef(revenueAmount)
  revenueAmountRef.current = revenueAmount
  const onAutoRevenueRef = React.useRef(onAutoRevenue)
  onAutoRevenueRef.current = onAutoRevenue

  const [hintTotal, setHintTotal] = React.useState<string | null>(null)
  const [hintCurrency, setHintCurrency] = React.useState('PLN')

  const quoteInput = React.useMemo(
    () =>
      buildDriverQuoteInputFromRoute({
        startedAtLocal: route.startedAtLocal,
        distanceKm: route.distanceKm,
      }),
    [route.distanceKm, route.startedAtLocal],
  )

  React.useEffect(() => {
    if (disabled) return

    clearTimeout(debounceRef.current)
    abortRef.current?.abort()

    if (!quoteInput) {
      setHintTotal(null)
      return
    }

    debounceRef.current = setTimeout(() => {
      const requestId = ++requestIdRef.current
      const controller = new AbortController()
      abortRef.current = controller

      void (async () => {
        try {
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
            setHintTotal(null)
            return
          }

          const quotedTotal = data.totalPrice.toFixed(2)
          const currency = data.currency ?? 'PLN'
          setHintTotal(quotedTotal)
          setHintCurrency(currency)

          const currentRevenue = String(revenueAmountRef.current ?? '').trim()
          const shouldSync =
            isBlankOrZeroRevenue(currentRevenue) ||
            currentRevenue === lastAutoRevenueRef.current ||
            currentRevenue === quotedTotal

          if (shouldSync) {
            if (currentRevenue !== quotedTotal) {
              onAutoRevenueRef.current(quotedTotal)
            }
            lastAutoRevenueRef.current = quotedTotal
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return
          setHintTotal(null)
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
  }, [disabled, quoteInput])

  if (!hintTotal) return null

  return (
    <p className={`${driverMutedTextClass} mt-1.5`}>
      {t('taxi_fleet.driverApp.trips.quoteHint', 'Suggested price')}:{' '}
      <span className="font-semibold tabular-nums text-[#071437]">
        {hintTotal} {hintCurrency}
      </span>
    </p>
  )
}
