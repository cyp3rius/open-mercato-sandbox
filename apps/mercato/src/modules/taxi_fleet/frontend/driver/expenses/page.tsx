'use client'

import React from 'react'
import Link from 'next/link'
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { formatMoneyDisplay } from '@open-mercato/shared/lib/numeric'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'
import { DriverShell } from '../../../components/driverApp/DriverShell'
import { useRegisterDriverPullToRefresh } from '../../../components/driverApp/DriverPullToRefresh'
import {
  driverBadgeInfoClass,
  driverBadgeSuccessClass,
  driverFieldClass,
  driverListRowStaticClass,
  driverMutedTextClass,
  driverPrimaryActionClass,
  driverSecondaryActionClass,
} from '../../../components/driverApp/driverUi'
import type {
  DriverExpenseListItem,
  DriverExpenseSortField,
  DriverExpenseWarning,
} from '../../../lib/driverExpenses'
import { formatReceiptOcrWarningLabel } from '../../../lib/receiptOcrWarningLabel'

const PAGE_SIZE = 10

type ExpensesListResponse = {
  items: DriverExpenseListItem[]
  page: number
  pageSize: number
  total: number
  sort: DriverExpenseSortField
  order: 'asc' | 'desc'
}

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

function warningLabel(
  t: (key: string, fallback?: string, params?: Record<string, string | number>) => string,
  warning: DriverExpenseWarning,
): string {
  return formatReceiptOcrWarningLabel(t, warning)
}

function isExpenseOcrProcessing(item: DriverExpenseListItem): boolean {
  if (item.ocrStatus === 'pending' || item.ocrStatus === 'processing') return true
  if (!item.receiptAttachmentId) return false
  if (item.ocrStatus === 'failed' || item.ocrStatus === 'applied' || item.ocrStatus === 'needs_review' || item.ocrStatus === 'extracted') {
    return false
  }
  const amount = Number(item.amount)
  return !Number.isFinite(amount) || amount <= 0
}

function expenseHasWarnings(item: DriverExpenseListItem): boolean {
  if (item.warnings.length > 0) return true
  if (item.ocrStatus === 'needs_review' || item.ocrStatus === 'failed') return true
  return false
}

function isExpenseOcrVerified(item: DriverExpenseListItem): boolean {
  if (!item.receiptAttachmentId) return false
  if (isExpenseOcrProcessing(item)) return false
  if (expenseHasWarnings(item)) return false
  return item.ocrStatus === 'applied' || item.ocrStatus === 'extracted'
}

function ExpenseOcrStatusBadge({
  item,
  t,
}: {
  item: DriverExpenseListItem
  t: (key: string, fallback?: string) => string
}) {
  if (expenseHasWarnings(item)) return null
  if (isExpenseOcrProcessing(item)) {
    return (
      <span className={`${driverBadgeInfoClass} gap-1`}>
        <Loader2 className="size-3 animate-spin" aria-hidden />
        {t('taxi_fleet.driverApp.expenses.processingBadge', 'Processing')}
      </span>
    )
  }
  if (isExpenseOcrVerified(item)) {
    return (
      <span className={`${driverBadgeSuccessClass} gap-1`}>
        <Check className="size-3" aria-hidden />
        {t('taxi_fleet.driverApp.expenses.verifiedBadge', 'Verified')}
      </span>
    )
  }
  return null
}

function ExpenseWarnings({
  item,
  t,
}: {
  item: DriverExpenseListItem
  t: (key: string, fallback?: string) => string
}) {
  if (isExpenseOcrProcessing(item)) return null

  const messages: string[] = item.warnings.map((warning) => warningLabel(t, warning))
  if (messages.length === 0 && item.ocrStatus === 'needs_review') {
    messages.push(
      t(
        'taxi_fleet.driverApp.expenses.needsReview',
        'Document needs review — check OCR results.',
      ),
    )
  }
  if (messages.length === 0 && item.ocrStatus === 'failed') {
    messages.push(
      t(
        'taxi_fleet.driverApp.expenses.ocrFailed',
        'Receipt OCR failed — you can delete and try again.',
      ),
    )
  }
  if (messages.length === 0) return null

  return (
    <div
      className="mt-3 rounded-lg border border-[#F6E5A5] bg-[#FFF8DD] px-3 py-2.5"
      role="status"
    >
      <div className="flex gap-2.5">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#DFA000]" aria-hidden />
        <div className="min-w-0 space-y-1">
          <div className="text-xs font-semibold text-[#7A5B00]">
            {t('taxi_fleet.driverApp.expenses.warningTitle', 'Attention')}
          </div>
          <ul className="space-y-1">
            {messages.map((message, index) => (
              <li key={`${item.id}-warn-${index}`} className="text-xs leading-snug text-[#7A5B00]">
                {message}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default function DriverExpensesPage() {
  const t = useT()
  const [items, setItems] = React.useState<DriverExpenseListItem[]>([])
  const [loaded, setLoaded] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<DriverExpenseListItem | null>(null)
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [sort, setSort] = React.useState<DriverExpenseSortField>('occurredAt')
  const [order, setOrder] = React.useState<'asc' | 'desc'>('desc')

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)

  const loadExpenses = React.useCallback(
    async (nextPage: number, nextSort: DriverExpenseSortField, nextOrder: 'asc' | 'desc') => {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(PAGE_SIZE),
        sort: nextSort,
        order: nextOrder,
      })
      const { ok, result } = await apiCall<ExpensesListResponse>(
        `/api/taxi_fleet/driver/expenses?${params.toString()}`,
      )
      if (!ok || !result) throw new Error('load_failed')
      setItems(result.items ?? [])
      setTotal(result.total ?? 0)
      setPage(result.page ?? nextPage)
      setSort(result.sort ?? nextSort)
      setOrder(result.order === 'asc' ? 'asc' : 'desc')
    },
    [],
  )

  React.useEffect(() => {
    let active = true
    ;(async () => {
      try {
        await loadExpenses(page, sort, order)
      } catch {
        if (!active) return
        flash(t('taxi_fleet.driverApp.expenses.loadFailed', 'Could not load expenses.'), 'error')
      } finally {
        if (active) setLoaded(true)
      }
    })()
    return () => {
      active = false
    }
    // Initial + page/sort changes are driven by explicit handlers; keep deps minimal for first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    if (page !== safePage) setPage(safePage)
  }, [page, safePage])

  const refreshCurrent = React.useCallback(async () => {
    await loadExpenses(safePage, sort, order)
  }, [loadExpenses, order, safePage, sort])

  useRegisterDriverPullToRefresh(async () => {
    await refreshCurrent().catch(() => undefined)
  })

  React.useEffect(() => {
    const waitingForOcr = items.some((item) => {
      const amount = Number(item.amount)
      const amountEmpty = !Number.isFinite(amount) || amount <= 0
      return (
        item.ocrStatus === 'pending' ||
        item.ocrStatus === 'processing' ||
        (Boolean(item.receiptAttachmentId) && amountEmpty && item.ocrStatus !== 'failed')
      )
    })
    if (!waitingForOcr) return
    const timer = window.setInterval(() => {
      void refreshCurrent().catch(() => undefined)
    }, 3000)
    return () => window.clearInterval(timer)
  }, [items, refreshCurrent])

  const changeSort = React.useCallback(
    async (value: string) => {
      const [nextSortRaw, nextOrderRaw] = value.split(':')
      const nextSort: DriverExpenseSortField =
        nextSortRaw === 'createdAt' ? 'createdAt' : 'occurredAt'
      const nextOrder = nextOrderRaw === 'asc' ? 'asc' : 'desc'
      setLoaded(false)
      try {
        await loadExpenses(1, nextSort, nextOrder)
      } catch {
        flash(t('taxi_fleet.driverApp.expenses.loadFailed', 'Could not load expenses.'), 'error')
      } finally {
        setLoaded(true)
      }
    },
    [loadExpenses, t],
  )

  const goToPage = React.useCallback(
    async (nextPage: number) => {
      setLoaded(false)
      try {
        await loadExpenses(nextPage, sort, order)
      } catch {
        flash(t('taxi_fleet.driverApp.expenses.loadFailed', 'Could not load expenses.'), 'error')
      } finally {
        setLoaded(true)
      }
    },
    [loadExpenses, order, sort, t],
  )

  const confirmDelete = React.useCallback(async () => {
    const item = pendingDelete
    if (!item) return
    setPendingDelete(null)
    setDeletingId(item.id)
    try {
      const deleted = await apiCall(`/api/taxi_fleet/driver/expenses?id=${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
      })
      if (!deleted.ok) throw new Error('delete_failed')
      flash(t('taxi_fleet.driverApp.expenses.deleted', 'Cost deleted.'), 'success')
      await refreshCurrent()
    } catch {
      flash(t('taxi_fleet.driverApp.expenses.deleteFailed', 'Could not delete the cost.'), 'error')
    } finally {
      setDeletingId(null)
    }
  }, [pendingDelete, refreshCurrent, t])

  const sortValue = `${sort}:${order}`
  const canGoPrev = safePage > 1
  const canGoNext = safePage < pageCount

  return (
    <DriverShell title={t('taxi_fleet.driverApp.expenses.title', 'Expenses')}>
      {pendingDelete ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="driver-expense-delete-title"
            className="w-full max-w-md rounded-xl border border-[#F1F1F4] bg-white p-5 text-[#071437] shadow-lg"
          >
            <h2 id="driver-expense-delete-title" className="text-base font-semibold text-[#071437]">
              {t('taxi_fleet.driverApp.expenses.deleteConfirmTitle', 'Delete this cost?')}
            </h2>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className={`${driverSecondaryActionClass} sm:w-auto`}
                onClick={() => setPendingDelete(null)}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-[#F8285A] px-4 text-sm font-medium text-white transition-colors hover:bg-[#D81A48] sm:w-auto"
                onClick={() => void confirmDelete()}
              >
                {t('taxi_fleet.driverApp.expenses.delete', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="space-y-4">
        <Link href="/driver/expenses/new" className={`${driverPrimaryActionClass} gap-2`}>
          <Plus className="size-4" aria-hidden />
          {t('taxi_fleet.driverApp.expenses.new', 'Register a cost')}
        </Link>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[#071437]">
            {t('taxi_fleet.driverApp.expenses.sortLabel', 'Sort by')}
          </span>
          <select
            className={driverFieldClass}
            value={sortValue}
            onChange={(event) => void changeSort(event.target.value)}
          >
            <option value="occurredAt:desc">
              {t('taxi_fleet.driverApp.expenses.sort.occurredAtDesc', 'Document date (newest)')}
            </option>
            <option value="occurredAt:asc">
              {t('taxi_fleet.driverApp.expenses.sort.occurredAtAsc', 'Document date (oldest)')}
            </option>
            <option value="createdAt:desc">
              {t('taxi_fleet.driverApp.expenses.sort.createdAtDesc', 'Added (newest)')}
            </option>
            <option value="createdAt:asc">
              {t('taxi_fleet.driverApp.expenses.sort.createdAtAsc', 'Added (oldest)')}
            </option>
          </select>
        </label>

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
          <div key={item.id} className={driverListRowStaticClass}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold text-[#071437]">
                    {t(`taxi_fleet.financial.costTypes.${item.costType ?? 'other'}`, item.costType ?? 'other')}
                  </div>
                  <ExpenseOcrStatusBadge item={item} t={t} />
                </div>
                <div className="mt-0.5 text-xs text-[#78829D]">
                  {t('taxi_fleet.driverApp.expenses.documentDate', 'Document')}:{' '}
                  {formatOccurredAt(item.occurredAt)}
                </div>
                <div className="mt-0.5 text-xs text-[#78829D]">
                  {t('taxi_fleet.driverApp.expenses.addedDate', 'Added')}:{' '}
                  {formatOccurredAt(item.createdAt)}
                </div>
                <div className="mt-0.5 text-xs text-[#78829D]">
                  {t('taxi_fleet.driverApp.expenses.vatLabel', 'VAT {rate}%', {
                    rate: item.vatRatePercent ?? '23',
                  })}
                </div>
                {item.documentNumber ? (
                  <div className="mt-0.5 truncate text-xs text-[#4B5675]">{item.documentNumber}</div>
                ) : null}
                {item.pending ? (
                  <div className="mt-1 text-[11px] font-medium text-[#1B84FF]">
                    {t('taxi_fleet.driverApp.receipt.queuedOffline', 'saved offline')}
                  </div>
                ) : null}
              </div>
              <div className="shrink-0 text-right text-sm font-semibold tabular-nums text-[#071437]">
                {formatMoneyDisplay(item.amount, { currency: item.currencyCode || 'PLN' })}
              </div>
            </div>
            <ExpenseWarnings item={item} t={t} />
            {item.canDelete ? (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  disabled={deletingId === item.id}
                  onClick={() => {
                    if (!item.canDelete) return
                    setPendingDelete(item)
                  }}
                  className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-[#F8285A] bg-transparent px-3 text-xs font-medium text-[#F8285A] shadow-none outline-none transition-colors hover:border-[#D81A48] hover:bg-transparent hover:text-[#D81A48] focus-visible:ring-2 focus-visible:ring-[#F8285A]/25 disabled:pointer-events-none disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  {t('taxi_fleet.driverApp.expenses.delete', 'Delete')}
                </button>
              </div>
            ) : null}
          </div>
        ))}

        {loaded && total > PAGE_SIZE ? (
          <div className="flex items-center justify-between gap-3 pt-1">
            <Button
              type="button"
              variant="ghost"
              disabled={!canGoPrev}
              className="h-10 gap-1 px-2 text-[#78829D] hover:!bg-[#F1F1F4]/50 hover:!text-[#4B5675] disabled:opacity-40"
              onClick={() => void goToPage(safePage - 1)}
              aria-label={t('taxi_fleet.driverApp.expenses.pagePrev', 'Previous')}
            >
              <ChevronLeft className="size-4" aria-hidden />
              {t('taxi_fleet.driverApp.expenses.pagePrev', 'Previous')}
            </Button>

            <div className="flex items-center gap-1.5" aria-hidden>
              {Array.from({ length: pageCount }, (_, index) => (
                <span
                  key={`dot-${index}`}
                  className={`size-1.5 rounded-full ${
                    index + 1 === safePage ? 'bg-[#1B84FF]' : 'bg-[#DBDFE9]'
                  }`}
                />
              ))}
            </div>

            <Button
              type="button"
              variant="ghost"
              disabled={!canGoNext}
              className="h-10 gap-1 px-2 text-[#78829D] hover:!bg-[#F1F1F4]/50 hover:!text-[#4B5675] disabled:opacity-40"
              onClick={() => void goToPage(safePage + 1)}
              aria-label={t('taxi_fleet.driverApp.expenses.pageNext', 'Next')}
            >
              {t('taxi_fleet.driverApp.expenses.pageNext', 'Next')}
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        ) : null}
      </div>
    </DriverShell>
  )
}
