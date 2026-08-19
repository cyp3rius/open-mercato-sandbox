'use client'

import React from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { formatMoneyDisplay } from '@open-mercato/shared/lib/numeric'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { DriverShell } from '../../../components/driverApp/DriverShell'
import {
  driverListRowClass,
  driverMutedTextClass,
  driverPrimaryActionClass,
} from '../../../components/driverApp/driverUi'
import { cacheDriverJson, readCachedDriverJson } from '../../../lib/driverOffline/outbox'
import type { DriverExpenseListItem } from '../../../lib/driverExpenses'

function formatOccurredAt(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function normalizeCached(cached: DriverExpenseListItem[] | { items?: DriverExpenseListItem[] } | null) {
  if (!cached) return []
  if (Array.isArray(cached)) return cached
  return Array.isArray(cached.items) ? cached.items : []
}

export default function DriverExpensesPage() {
  const t = useT()
  const [items, setItems] = React.useState<DriverExpenseListItem[]>([])
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const { result } = await apiCall<{ items: DriverExpenseListItem[] }>(
          '/api/taxi_fleet/driver/expenses',
        )
        if (!active) return
        const next = result.items ?? []
        setItems(next)
        await cacheDriverJson('driver/expenses', next)
      } catch {
        const cached = normalizeCached(
          await readCachedDriverJson<DriverExpenseListItem[] | { items?: DriverExpenseListItem[] }>(
            'driver/expenses',
          ),
        )
        if (!active) return
        if (cached.length) {
          setItems(cached)
          flash(t('taxi_fleet.driverApp.usingCache', 'Showing cached data (offline).'), 'warning')
        } else {
          flash(t('taxi_fleet.driverApp.expenses.loadFailed', 'Could not load expenses.'), 'error')
        }
      } finally {
        if (active) setLoaded(true)
      }
    })()
    return () => {
      active = false
    }
  }, [t])

  return (
    <DriverShell title={t('taxi_fleet.driverApp.expenses.title', 'Expenses')}>
      <div className="space-y-4">
        <Link href="/driver/expenses/new" className={`${driverPrimaryActionClass} gap-2`}>
          <Plus className="size-4" aria-hidden />
          {t('taxi_fleet.driverApp.expenses.new', 'Register a cost')}
        </Link>

        {!loaded ? (
          <div className={`px-1 py-8 text-center ${driverMutedTextClass}`}>
            {t('taxi_fleet.driverApp.loading', 'Loading…')}
          </div>
        ) : null}

        {loaded && items.length === 0 ? (
          <p className={`px-1 text-center ${driverMutedTextClass}`}>
            {t('taxi_fleet.driverApp.expenses.empty', 'No costs registered yet.')}
          </p>
        ) : null}

        {items.map((item) => (
          <div key={item.id} className={driverListRowClass}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#071437]">
                  {t(`taxi_fleet.financial.costTypes.${item.costType ?? 'other'}`, item.costType ?? 'other')}
                </div>
                <div className="mt-0.5 text-xs text-[#78829D]">{formatOccurredAt(item.occurredAt)}</div>
                <div className="mt-0.5 text-xs text-[#78829D]">
                  {t('taxi_fleet.driverApp.expenses.vatLabel', 'VAT {rate}%', {
                    rate: item.vatRatePercent ?? '23',
                  })}
                </div>
                {item.documentNumber ? (
                  <div className="mt-0.5 truncate text-xs text-[#4B5675]">{item.documentNumber}</div>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold tabular-nums text-[#071437]">
                  {formatMoneyDisplay(item.amount, { currency: item.currencyCode || 'PLN' })}
                </div>
                {item.pending ? (
                  <div className="mt-0.5 text-[11px] font-medium text-[#1B84FF]">
                    {t('taxi_fleet.driverApp.receipt.queuedOffline', 'saved offline')}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </DriverShell>
  )
}
