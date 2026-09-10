'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { formatMoneyDisplay } from '@open-mercato/shared/lib/numeric'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { DriverShell } from '../../../components/driverApp/DriverShell'
import {
  driverBadgeNeutralClass,
  driverListRowClass,
  driverMutedTextClass,
  driverSecondaryActionClass,
} from '../../../components/driverApp/driverUi'
import { formatWeekRange } from '../../../lib/weekUtils'
import type {
  DriverMonthlySettlementListItem,
  DriverSettlementListItem,
} from '../../../lib/driverSettlements'

const PAGE_SIZE = 10

type TabId = 'monthly' | 'weekly'

type WeeklyResponse = {
  items: DriverSettlementListItem[]
  page: number
  pageSize: number
  total: number
}

type MonthlyResponse = {
  items: DriverMonthlySettlementListItem[]
  page: number
  pageSize: number
  total: number
}

function statusLabel(t: (key: string, fallback?: string) => string, status: string): string {
  const key = `taxi_fleet.settlements.statuses.${status}`
  const fallback =
    status === 'draft'
      ? 'Draft'
      : status === 'submitted'
        ? 'Submitted'
        : status === 'approved'
          ? 'Approved'
          : status === 'paid'
            ? 'Paid'
            : status
  return t(key, fallback)
}

export default function DriverSettlementsPage() {
  const t = useT()
  const [tab, setTab] = React.useState<TabId>('monthly')
  const [weeklyItems, setWeeklyItems] = React.useState<DriverSettlementListItem[]>([])
  const [monthlyItems, setMonthlyItems] = React.useState<DriverMonthlySettlementListItem[]>([])
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [loaded, setLoaded] = React.useState(false)

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)

  const load = React.useCallback(
    async (nextTab: TabId, nextPage: number) => {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(PAGE_SIZE),
      })
      if (nextTab === 'monthly') {
        const call = await apiCall<MonthlyResponse>(`/api/taxi_fleet/driver/monthly-settlements?${params}`)
        if (!call.ok) {
          if (call.status === 401 || call.status === 403) {
            window.location.href = '/driver/login'
            return
          }
          throw new Error('load_failed')
        }
        setMonthlyItems(Array.isArray(call.result?.items) ? call.result.items : [])
        setTotal(call.result?.total ?? 0)
        setPage(call.result?.page ?? nextPage)
        return
      }
      const call = await apiCall<WeeklyResponse>(`/api/taxi_fleet/driver/settlements?${params}`)
      if (!call.ok) {
        if (call.status === 401 || call.status === 403) {
          window.location.href = '/driver/login'
          return
        }
        throw new Error('load_failed')
      }
      setWeeklyItems(Array.isArray(call.result?.items) ? call.result.items : [])
      setTotal(call.result?.total ?? 0)
      setPage(call.result?.page ?? nextPage)
    },
    [],
  )

  React.useEffect(() => {
    let active = true
    void (async () => {
      try {
        await load(tab, 1)
      } catch {
        if (!active) return
        flash(t('taxi_fleet.driverApp.settlements.loadFailed', 'Could not load settlements.'), 'error')
      } finally {
        if (active) setLoaded(true)
      }
    })()
    return () => {
      active = false
    }
  }, [load, t, tab])

  const switchTab = React.useCallback(
    async (nextTab: TabId) => {
      if (nextTab === tab) return
      setLoaded(false)
      setTab(nextTab)
      setPage(1)
      try {
        await load(nextTab, 1)
      } catch {
        flash(t('taxi_fleet.driverApp.settlements.loadFailed', 'Could not load settlements.'), 'error')
      } finally {
        setLoaded(true)
      }
    },
    [load, t, tab],
  )

  const goToPage = React.useCallback(
    async (nextPage: number) => {
      setLoaded(false)
      try {
        await load(tab, nextPage)
      } catch {
        flash(t('taxi_fleet.driverApp.settlements.loadFailed', 'Could not load settlements.'), 'error')
      } finally {
        setLoaded(true)
      }
    },
    [load, t, tab],
  )

  const canGoPrev = safePage > 1
  const canGoNext = safePage < pageCount

  return (
    <DriverShell title={t('taxi_fleet.driverApp.settlements.title', 'Settlements')}>
      <div className="space-y-3">
        <div className="flex rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-1">
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
              tab === 'monthly' ? 'bg-white text-[#071437] shadow-sm' : 'text-[#78829D]'
            }`}
            onClick={() => void switchTab('monthly')}
          >
            {t('taxi_fleet.driverApp.settlements.tabs.monthly', 'Monthly (payout)')}
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
              tab === 'weekly' ? 'bg-white text-[#071437] shadow-sm' : 'text-[#78829D]'
            }`}
            onClick={() => void switchTab('weekly')}
          >
            {t('taxi_fleet.driverApp.settlements.tabs.weekly', 'Weekly (control)')}
          </button>
        </div>

        {!loaded ? (
          <p className={driverMutedTextClass}>{t('taxi_fleet.driverApp.settlements.loading', 'Loading…')}</p>
        ) : tab === 'monthly' ? (
          monthlyItems.length === 0 ? (
            <p className={driverMutedTextClass}>
              {t(
                'taxi_fleet.driverApp.settlements.monthlyEmpty',
                'No approved monthly payouts yet.',
              )}
            </p>
          ) : (
            <ul className="space-y-2">
              {monthlyItems.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/driver/monthly-settlements/${encodeURIComponent(item.id)}`}
                    className={driverListRowClass}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-[#071437]">{item.monthStart.slice(0, 7)}</div>
                        <div className="mt-1">
                          <span className={driverBadgeNeutralClass}>{statusLabel(t, item.status)}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-xs text-[#78829D]">
                          {t('taxi_fleet.driverApp.settlements.payout', 'Payout')}
                        </div>
                        <div className="text-base font-semibold tabular-nums text-[#071437]">
                          {formatMoneyDisplay(item.payoutAmount)}
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )
        ) : weeklyItems.length === 0 ? (
          <p className={driverMutedTextClass}>
            {t('taxi_fleet.driverApp.settlements.empty', 'No weekly settlements yet.')}
          </p>
        ) : (
          <ul className="space-y-2">
            {weeklyItems.map((item) => (
              <li key={item.id}>
                <Link href={`/driver/settlements/${encodeURIComponent(item.id)}`} className={driverListRowClass}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-[#071437]">{formatWeekRange(item.weekStart)}</div>
                      <div className="mt-1">
                        <span className={driverBadgeNeutralClass}>{statusLabel(t, item.status)}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xs text-[#78829D]">
                        {t('taxi_fleet.driverApp.settlements.controlNet', 'Net (control)')}
                      </div>
                      <div className="text-base font-semibold tabular-nums text-[#071437]">
                        {formatMoneyDisplay(item.netAmount)}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {loaded && total > PAGE_SIZE ? (
          <div className="flex items-center justify-between gap-2 pt-2">
            <button
              type="button"
              className={driverSecondaryActionClass}
              disabled={!canGoPrev}
              onClick={() => void goToPage(safePage - 1)}
            >
              <ChevronLeft className="size-4" aria-hidden />
              {t('common.prev', 'Previous')}
            </button>
            <span className={`text-sm ${driverMutedTextClass}`}>
              {safePage}/{pageCount}
            </span>
            <button
              type="button"
              className={driverSecondaryActionClass}
              disabled={!canGoNext}
              onClick={() => void goToPage(safePage + 1)}
            >
              {t('common.next', 'Next')}
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
    </DriverShell>
  )
}
