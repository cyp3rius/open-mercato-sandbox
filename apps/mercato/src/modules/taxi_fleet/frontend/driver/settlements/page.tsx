'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { formatMoneyDisplay } from '@open-mercato/shared/lib/numeric'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'
import { DriverShell } from '../../../components/driverApp/DriverShell'
import { useRegisterDriverPullToRefresh } from '../../../components/driverApp/DriverPullToRefresh'
import {
  DRIVER_LIST_PAGE_SIZE,
  useDriverPagedList,
} from '../../../components/driverApp/useDriverPagedList'
import {
  driverBadgeNeutralClass,
  driverListRowClass,
  driverMutedTextClass,
} from '../../../components/driverApp/driverUi'
import { formatWeekRange } from '../../../lib/weekUtils'
import type {
  DriverMonthlySettlementListItem,
  DriverSettlementListItem,
} from '../../../lib/driverSettlements'

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

  const fetchPage = React.useCallback(
    async (page: number, pageSize: number) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      })
      if (tab === 'monthly') {
        const call = await apiCall<MonthlyResponse>(
          `/api/taxi_fleet/driver/monthly-settlements?${params}`,
        )
        if (!call.ok) {
          if (call.status === 401 || call.status === 403) {
            window.location.href = '/driver/login'
            throw new Error('unauthorized')
          }
          throw new Error('load_failed')
        }
        return {
          items: (Array.isArray(call.result?.items) ? call.result.items : []) as (
            | DriverMonthlySettlementListItem
            | DriverSettlementListItem
          )[],
          page: call.result?.page ?? page,
          pageSize: call.result?.pageSize ?? pageSize,
          total: call.result?.total ?? 0,
        }
      }
      const call = await apiCall<WeeklyResponse>(`/api/taxi_fleet/driver/settlements?${params}`)
      if (!call.ok) {
        if (call.status === 401 || call.status === 403) {
          window.location.href = '/driver/login'
          throw new Error('unauthorized')
        }
        throw new Error('load_failed')
      }
      return {
        items: (Array.isArray(call.result?.items) ? call.result.items : []) as (
          | DriverMonthlySettlementListItem
          | DriverSettlementListItem
        )[],
        page: call.result?.page ?? page,
        pageSize: call.result?.pageSize ?? pageSize,
        total: call.result?.total ?? 0,
      }
    },
    [tab],
  )

  const {
    items,
    page,
    pageCount,
    total,
    loading,
    error,
    goToPage,
    reload,
    canGoPrev,
    canGoNext,
  } = useDriverPagedList<DriverMonthlySettlementListItem | DriverSettlementListItem>({
    queryKey: `settlements:${tab}`,
    fetchPage,
    pageSize: DRIVER_LIST_PAGE_SIZE,
  })

  React.useEffect(() => {
    if (error) {
      flash(t('taxi_fleet.driverApp.settlements.loadFailed', 'Could not load settlements.'), 'error')
    }
  }, [error, t])

  useRegisterDriverPullToRefresh(async () => {
    await reload().catch(() => undefined)
  })

  const monthlyItems = tab === 'monthly' ? (items as DriverMonthlySettlementListItem[]) : []
  const weeklyItems = tab === 'weekly' ? (items as DriverSettlementListItem[]) : []

  return (
    <DriverShell title={t('taxi_fleet.driverApp.settlements.title', 'Settlements')}>
      <div className="space-y-3">
        <div className="flex rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-1">
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
              tab === 'monthly' ? 'bg-white text-[#071437] shadow-sm' : 'text-[#78829D]'
            }`}
            onClick={() => setTab('monthly')}
          >
            {t('taxi_fleet.driverApp.settlements.tabs.monthly', 'Monthly (payout)')}
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
              tab === 'weekly' ? 'bg-white text-[#071437] shadow-sm' : 'text-[#78829D]'
            }`}
            onClick={() => setTab('weekly')}
          >
            {t('taxi_fleet.driverApp.settlements.tabs.weekly', 'Weekly (control)')}
          </button>
        </div>

        {loading && items.length === 0 ? (
          <p className={driverMutedTextClass}>
            {t('taxi_fleet.driverApp.settlements.loading', 'Loading…')}
          </p>
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

        {pageCount > 1 ? (
          <div className="flex items-center justify-between gap-3 pt-1">
            <Button
              type="button"
              variant="ghost"
              disabled={!canGoPrev || loading}
              className="h-10 gap-1 px-2 text-[#78829D] hover:!bg-[#F1F1F4]/50 hover:!text-[#4B5675] disabled:opacity-40"
              onClick={() => goToPage(page - 1)}
              aria-label={t('taxi_fleet.driverApp.settlements.pagePrev', 'Previous')}
            >
              <ChevronLeft className="size-4" aria-hidden />
              {t('taxi_fleet.driverApp.settlements.pagePrev', 'Previous')}
            </Button>

            <div className={`text-xs tabular-nums ${driverMutedTextClass}`}>
              {t('taxi_fleet.driverApp.pagination.pageOf', 'Page {page} of {totalPages}', {
                page,
                totalPages: pageCount,
              })}
              {total > 0
                ? ` · ${t('taxi_fleet.driverApp.pagination.total', '{total} total', { total })}`
                : null}
            </div>

            <Button
              type="button"
              variant="ghost"
              disabled={!canGoNext || loading}
              className="h-10 gap-1 px-2 text-[#78829D] hover:!bg-[#F1F1F4]/50 hover:!text-[#4B5675] disabled:opacity-40"
              onClick={() => goToPage(page + 1)}
              aria-label={t('taxi_fleet.driverApp.settlements.pageNext', 'Next')}
            >
              {t('taxi_fleet.driverApp.settlements.pageNext', 'Next')}
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        ) : null}
      </div>
    </DriverShell>
  )
}
