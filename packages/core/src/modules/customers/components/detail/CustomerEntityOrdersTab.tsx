'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { LoadingMessage, TabEmptyState } from '@open-mercato/ui/backend/detail'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { cn } from '@open-mercato/shared/lib/utils'
import {
  buildSimpleOrderCreateHref,
  type CustomerCreatePrefillInput,
} from './customerEntityCreatePrefill'
import { DetailTabAddToolbar } from './DetailTabAddToolbar'

const PAGE_SIZE = 50

const TERMINAL_ORDER_STATUSES = new Set([
  'cancelled',
  'canceled',
  'completed',
  'fulfilled',
  'closed',
  'done',
])

type OrderRow = {
  id: string
  number?: string | null
  status?: string | null
  date?: string | null
  totalGross?: number | null
  currency?: string | null
}

export type CustomerEntityOrdersTabProps = {
  customerEntityId: string
  ownerUserId?: string | null
  kind: CustomerCreatePrefillInput['kind']
  addActionLabel: string
  emptyState: { title: string; actionLabel: string }
}

function isHistoricalStatus(status: string | null | undefined): boolean {
  if (!status || !status.trim()) return false
  return TERMINAL_ORDER_STATUSES.has(status.trim().toLowerCase())
}

export function CustomerEntityOrdersTab({
  customerEntityId,
  ownerUserId,
  kind,
  addActionLabel,
  emptyState,
}: CustomerEntityOrdersTabProps) {
  const t = useT()
  const router = useRouter()
  const scopeVersion = useOrganizationScopeVersion()
  const [rows, setRows] = React.useState<OrderRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const createHref = React.useMemo(
    () => buildSimpleOrderCreateHref({ customerEntityId, ownerUserId, kind }),
    [customerEntityId, kind, ownerUserId],
  )

  const openCreate = React.useCallback(() => {
    router.push(createHref)
  }, [createHref, router])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          page: '1',
          pageSize: String(PAGE_SIZE),
          customerId: customerEntityId,
          sortField: 'createdAt',
          sortDir: 'desc',
        })
        const call = await apiCall<{ items?: OrderRow[] }>(`/api/sales/orders?${params.toString()}`)
        if (cancelled) return
        if (!call.ok) {
          setError(t('customers.detail.linked.orders.loadError', 'Failed to load orders.'))
          setRows([])
          return
        }
        setRows(Array.isArray(call.result?.items) ? call.result.items : [])
      } catch {
        if (!cancelled) {
          setError(t('customers.detail.linked.orders.loadError', 'Failed to load orders.'))
          setRows([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [customerEntityId, scopeVersion, t])

  if (loading) {
    return <LoadingMessage label={t('customers.detail.linked.orders.loading', 'Loading orders…')} />
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (!rows.length) {
    return (
      <TabEmptyState
        title={emptyState.title}
        actionLabel={emptyState.actionLabel}
        onAction={openCreate}
      />
    )
  }

  return (
    <div className="space-y-3">
      <DetailTabAddToolbar label={addActionLabel} onClick={openCreate} />
      <ul className="divide-y rounded-md border">
        {rows.map((row) => {
          const historical = isHistoricalStatus(row.status)
          const number = typeof row.number === 'string' && row.number.trim() ? row.number : row.id
          return (
            <li key={row.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-muted/40"
                onClick={() => router.push(`/backend/sales/simple-orders/${encodeURIComponent(row.id)}`)}
              >
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-foreground">{number}</span>
                  {row.date ? (
                    <span className="ml-2 text-muted-foreground">{row.date.slice(0, 10)}</span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      historical
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
                    )}
                  >
                    {historical
                      ? t('customers.detail.linked.orders.badge.historical', 'Historical')
                      : t('customers.detail.linked.orders.badge.active', 'Active')}
                  </span>
                  {row.status ? (
                    <span className="text-xs text-muted-foreground">{row.status}</span>
                  ) : null}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
