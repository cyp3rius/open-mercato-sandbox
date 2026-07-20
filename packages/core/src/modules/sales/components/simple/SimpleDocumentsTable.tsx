"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable, withDataTableNamespaces } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'

export type SimpleDocumentKind = 'order' | 'quote'

type SimpleDocumentRow = {
  id: string
  number: string
  status?: string | null
  customerName?: string | null
  currency?: string | null
  date?: string | null
  totalGross?: number | null
}

const PAGE_SIZE = 20

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isNaN(value) ? null : value
  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

function resolveCustomerName(snapshot: Record<string, unknown> | null | undefined, fallback?: string | null) {
  if (!snapshot) return fallback ?? null
  const customer = snapshot.customer as Record<string, unknown> | undefined
  if (typeof customer?.displayName === 'string' && customer.displayName.trim()) return customer.displayName
  return fallback ?? null
}

export function SimpleDocumentsTable({ kind }: { kind: SimpleDocumentKind }) {
  const t = useT()
  const router = useRouter()
  const scopeVersion = useOrganizationScopeVersion()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [rows, setRows] = React.useState<SimpleDocumentRow[]>([])
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'createdAt', desc: true }])
  const [search, setSearch] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [canManage, setCanManage] = React.useState(false)
  const [reloadToken, setReloadToken] = React.useState(0)

  const resource = kind === 'order' ? 'orders' : 'quotes'
  const basePath = kind === 'order' ? '/backend/sales/simple-orders' : '/backend/sales/simple-quotes'
  const i18nPrefix = kind === 'order' ? 'sales.simpleOrders' : 'sales.simpleQuotes'
  const manageFeature = kind === 'order' ? 'sales.simple_orders.manage' : 'sales.simple_quotes.manage'
  const tableId = kind === 'order' ? 'sales.simpleOrders.list' : 'sales.simpleQuotes.list'
  const detailHref = React.useCallback((id: string) => `${basePath}/${encodeURIComponent(id)}`, [basePath])

  React.useEffect(() => {
    let cancelled = false
    async function loadPerm() {
      const call = await apiCall<{ granted?: string[]; ok?: boolean }>('/api/auth/feature-check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ features: [manageFeature] }),
      })
      if (cancelled) return
      const granted = Array.isArray(call.result?.granted) ? call.result.granted : []
      setCanManage(call.result?.ok === true || granted.includes(manageFeature))
    }
    void loadPerm()
    return () => {
      cancelled = true
    }
  }, [manageFeature])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (search.trim()) params.set('search', search.trim())
      if (sorting[0]?.id) {
        params.set('sortField', sorting[0].id)
        params.set('sortDir', sorting[0].desc ? 'desc' : 'asc')
      }
      const call = await apiCall<{ items?: Array<Record<string, unknown>>; total?: number; totalPages?: number }>(
        `/api/sales/${resource}?${params.toString()}`,
      )
      if (!call.ok) {
        flash(t(`${i18nPrefix}.errors.load`, 'Failed to load documents.'), 'error')
        return
      }
      const items = Array.isArray(call.result?.items) ? call.result.items : []
      setRows(
        items.map((item) => {
          const id = typeof item.id === 'string' ? item.id : ''
          const number =
            kind === 'order'
              ? (typeof item.orderNumber === 'string' ? item.orderNumber : null) ??
                (typeof item.order_number === 'string' ? item.order_number : id)
              : (typeof item.quoteNumber === 'string' ? item.quoteNumber : null) ??
                (typeof item.quote_number === 'string' ? item.quote_number : id)
          const snapshot =
            item.customerSnapshot && typeof item.customerSnapshot === 'object'
              ? (item.customerSnapshot as Record<string, unknown>)
              : null
          const date =
            (typeof item.placedAt === 'string' ? item.placedAt : null) ??
            (typeof item.validFrom === 'string' ? item.validFrom : null) ??
            (typeof item.createdAt === 'string' ? item.createdAt : null)
          return withDataTableNamespaces(
            {
              id,
              number,
              status: typeof item.status === 'string' ? item.status : null,
              customerName: resolveCustomerName(
                snapshot,
                typeof item.customerEntityId === 'string' ? item.customerEntityId : null,
              ),
              currency: typeof item.currencyCode === 'string' ? item.currencyCode : null,
              date,
              totalGross: toNumber(item.grandTotalGrossAmount),
            },
            item,
          )
        }),
      )
      setTotal(typeof call.result?.total === 'number' ? call.result.total : items.length)
      setTotalPages(typeof call.result?.totalPages === 'number' ? call.result.totalPages : 1)
    } catch (err) {
      console.error('simple.documents.load failed', err)
      flash(t(`${i18nPrefix}.errors.load`, 'Failed to load documents.'), 'error')
    } finally {
      setLoading(false)
    }
  }, [i18nPrefix, kind, page, resource, search, sorting, t])

  React.useEffect(() => {
    void load()
  }, [load, scopeVersion, reloadToken])

  const columns = React.useMemo<ColumnDef<SimpleDocumentRow>[]>(
    () => [
      {
        accessorKey: 'number',
        header: t(`${i18nPrefix}.columns.number`, 'Number'),
        cell: ({ row }) => (
          <Link href={detailHref(row.original.id)} className="font-medium hover:underline">
            {row.original.number}
          </Link>
        ),
      },
      {
        accessorKey: 'customerName',
        header: t(`${i18nPrefix}.columns.customer`, 'Customer'),
        cell: ({ row }) => row.original.customerName ?? '—',
      },
      {
        accessorKey: 'status',
        header: t(`${i18nPrefix}.columns.status`, 'Status'),
        cell: ({ row }) => row.original.status ?? '—',
      },
      {
        accessorKey: 'currency',
        header: t(`${i18nPrefix}.columns.currency`, 'Currency'),
        cell: ({ row }) => row.original.currency ?? '—',
      },
      {
        accessorKey: 'date',
        header: t(`${i18nPrefix}.columns.date`, 'Date'),
        cell: ({ row }) =>
          row.original.date ? new Date(row.original.date).toLocaleDateString() : '—',
      },
      {
        accessorKey: 'totalGross',
        header: t(`${i18nPrefix}.columns.total`, 'Total'),
        cell: ({ row }) =>
          row.original.totalGross != null
            ? `${row.original.totalGross.toFixed(2)} ${row.original.currency ?? ''}`.trim()
            : '—',
      },
    ],
    [detailHref, i18nPrefix, t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t(`${i18nPrefix}.list.title`, kind === 'order' ? 'Orders' : 'Quotes')}
          columns={columns}
          data={rows}
          isLoading={loading}
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          searchPlaceholder={t(`${i18nPrefix}.list.search`, 'Search…')}
          sorting={sorting}
          onSortingChange={setSorting}
          pagination={{ page, pageSize: PAGE_SIZE, total, totalPages, onPageChange: setPage }}
          perspective={{ tableId }}
          refreshButton={{
            onRefresh: () => {
              setSearch('')
              setPage(1)
              setReloadToken((token) => token + 1)
            },
            label: t(`${i18nPrefix}.list.actions.refresh`, 'Refresh'),
            isRefreshing: loading,
          }}
          actions={
            canManage ? (
              <Button asChild type="button" size="sm" className="inline-flex items-center gap-2">
                <Link href={`${basePath}/create`}>
                  <Plus className="size-4 shrink-0" aria-hidden />
                  {t(`${i18nPrefix}.actions.create`, 'Create')}
                </Link>
              </Button>
            ) : null
          }
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  id: 'view',
                  label: t(`${i18nPrefix}.list.actions.viewDetails`, 'View details'),
                  onSelect: () => router.push(detailHref(row.id)),
                },
                {
                  id: 'open-new-tab',
                  label: t(`${i18nPrefix}.list.actions.openInNewTab`, 'Open in new tab'),
                  onSelect: () => window.open(detailHref(row.id), '_blank', 'noopener,noreferrer'),
                },
                ...(canManage
                  ? [
                      {
                        id: 'delete',
                        label: t(`${i18nPrefix}.actions.delete`, 'Delete'),
                        destructive: true as const,
                        onSelect: async () => {
                          const ok = await confirm({
                            title: t(`${i18nPrefix}.actions.deleteConfirm`, 'Delete this document?'),
                            variant: 'destructive',
                          })
                          if (!ok) return
                          try {
                            await deleteCrud(`sales/${resource}`, row.id, {
                              errorMessage: t(`${i18nPrefix}.errors.delete`, 'Failed to delete.'),
                            })
                            flash(t(`${i18nPrefix}.success.delete`, 'Deleted.'), 'success')
                            setReloadToken((token) => token + 1)
                          } catch (err) {
                            flash(
                              err instanceof Error
                                ? err.message
                                : t(`${i18nPrefix}.errors.delete`, 'Failed to delete.'),
                              'error',
                            )
                          }
                        },
                      },
                    ]
                  : []),
              ]}
            />
          )}
          onRowClick={(row) => router.push(detailHref(row.id))}
        />
      </PageBody>
      {ConfirmDialogElement}
    </Page>
  )
}

export default SimpleDocumentsTable
