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

type DealRow = {
  id: string
  title: string
  status?: string | null
  pipelineStage?: string | null
  expectedCloseAt?: string | null
}

const PAGE_SIZE = 20
const BASE_PATH = '/backend/customers/simple-deals'
const MANAGE_FEATURE = 'customers.simple_deals.manage'

export default function SimpleDealsListPage() {
  const t = useT()
  const router = useRouter()
  const scopeVersion = useOrganizationScopeVersion()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [rows, setRows] = React.useState<DealRow[]>([])
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'updatedAt', desc: true }])
  const [search, setSearch] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [canManage, setCanManage] = React.useState(false)
  const [reloadToken, setReloadToken] = React.useState(0)

  const detailHref = React.useCallback((id: string) => `${BASE_PATH}/${encodeURIComponent(id)}`, [])

  React.useEffect(() => {
    let cancelled = false
    async function loadPerm() {
      const call = await apiCall<{ granted?: string[]; ok?: boolean }>('/api/auth/feature-check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ features: [MANAGE_FEATURE] }),
      })
      if (cancelled) return
      const granted = Array.isArray(call.result?.granted) ? call.result.granted : []
      setCanManage(call.result?.ok === true || granted.includes(MANAGE_FEATURE))
    }
    void loadPerm()
    return () => {
      cancelled = true
    }
  }, [])

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
        `/api/customers/deals?${params.toString()}`,
      )
      if (!call.ok) {
        flash(t('customers.simpleDeals.errors.load', 'Failed to load deals.'), 'error')
        return
      }
      const items = Array.isArray(call.result?.items) ? call.result.items : []
      setRows(
        items.map((item) =>
          withDataTableNamespaces(
            {
              id: typeof item.id === 'string' ? item.id : '',
              title: typeof item.title === 'string' ? item.title : '—',
              status: typeof item.status === 'string' ? item.status : null,
              pipelineStage: typeof item.pipelineStage === 'string' ? item.pipelineStage : null,
              expectedCloseAt: typeof item.expectedCloseAt === 'string' ? item.expectedCloseAt : null,
            },
            item,
          ),
        ),
      )
      setTotal(typeof call.result?.total === 'number' ? call.result.total : items.length)
      setTotalPages(typeof call.result?.totalPages === 'number' ? call.result.totalPages : 1)
    } catch (err) {
      console.error('simple.deals.load failed', err)
      flash(t('customers.simpleDeals.errors.load', 'Failed to load deals.'), 'error')
    } finally {
      setLoading(false)
    }
  }, [page, search, sorting, t])

  React.useEffect(() => {
    void load()
  }, [load, scopeVersion, reloadToken])

  const columns = React.useMemo<ColumnDef<DealRow>[]>(
    () => [
      {
        accessorKey: 'title',
        header: t('customers.simpleDeals.columns.title', 'Title'),
        cell: ({ row }) => (
          <Link href={detailHref(row.original.id)} className="font-medium hover:underline">
            {row.original.title}
          </Link>
        ),
      },
      {
        accessorKey: 'status',
        header: t('customers.simpleDeals.columns.status', 'Status'),
        cell: ({ row }) => row.original.status ?? '—',
      },
      {
        accessorKey: 'pipelineStage',
        header: t('customers.simpleDeals.columns.pipeline', 'Pipeline stage'),
        cell: ({ row }) => row.original.pipelineStage ?? '—',
      },
      {
        accessorKey: 'expectedCloseAt',
        header: t('customers.simpleDeals.columns.expectedCloseAt', 'Expected close'),
        cell: ({ row }) =>
          row.original.expectedCloseAt
            ? new Date(row.original.expectedCloseAt).toLocaleDateString()
            : '—',
      },
    ],
    [detailHref, t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('customers.simpleDeals.list.title', 'Deals')}
          columns={columns}
          data={rows}
          isLoading={loading}
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          searchPlaceholder={t('customers.simpleDeals.list.search', 'Search deals…')}
          sorting={sorting}
          onSortingChange={setSorting}
          pagination={{ page, pageSize: PAGE_SIZE, total, totalPages, onPageChange: setPage }}
          perspective={{ tableId: 'customers.simpleDeals.list' }}
          refreshButton={{
            onRefresh: () => {
              setSearch('')
              setPage(1)
              setReloadToken((token) => token + 1)
            },
            label: t('customers.simpleDeals.list.actions.refresh', 'Refresh'),
            isRefreshing: loading,
          }}
          actions={
            canManage ? (
              <Button asChild type="button" size="sm" className="inline-flex items-center gap-2">
                <Link href={`${BASE_PATH}/create`}>
                  <Plus className="size-4 shrink-0" aria-hidden />
                  {t('customers.simpleDeals.actions.create', 'Create')}
                </Link>
              </Button>
            ) : null
          }
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  id: 'view',
                  label: t('customers.simpleDeals.list.actions.viewDetails', 'View details'),
                  onSelect: () => router.push(detailHref(row.id)),
                },
                {
                  id: 'open-new-tab',
                  label: t('customers.simpleDeals.list.actions.openInNewTab', 'Open in new tab'),
                  onSelect: () => window.open(detailHref(row.id), '_blank', 'noopener,noreferrer'),
                },
                ...(canManage
                  ? [
                      {
                        id: 'delete',
                        label: t('customers.simpleDeals.actions.delete', 'Delete'),
                        destructive: true as const,
                        onSelect: async () => {
                          const ok = await confirm({
                            title: t('customers.simpleDeals.actions.deleteConfirm', 'Delete this deal?'),
                            variant: 'destructive',
                          })
                          if (!ok) return
                          try {
                            await deleteCrud('customers/deals', row.id, {
                              errorMessage: t('customers.simpleDeals.errors.delete', 'Failed to delete deal.'),
                            })
                            flash(t('customers.simpleDeals.success.delete', 'Deal deleted.'), 'success')
                            setReloadToken((token) => token + 1)
                          } catch (err) {
                            flash(
                              err instanceof Error
                                ? err.message
                                : t('customers.simpleDeals.errors.delete', 'Failed to delete deal.'),
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
