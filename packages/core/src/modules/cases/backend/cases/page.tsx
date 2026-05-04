"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import type { FilterDef, FilterValues } from '@open-mercato/ui/backend/FilterBar'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { CaseStatusBadge } from '../../components/CaseStatusBadge'

const PAGE_SIZE = 20

type CaseRow = {
  id: string
  title: string
  statusValue?: string
  customerEntityId?: string
  customerDisplayName?: string | null
  ownerUserId?: string | null
  updatedAt?: string | null
}

type ListResponse = {
  items: CaseRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export default function CasesListPage() {
  const router = useRouter()
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [rows, setRows] = React.useState<CaseRow[]>([])
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [search, setSearch] = React.useState('')
  const [filterValues, setFilterValues] = React.useState<FilterValues>({})
  const [isLoading, setIsLoading] = React.useState(true)
  const [canManage, setCanManage] = React.useState(false)
  const [reloadToken, setReloadToken] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    async function loadPerm() {
      const call = await apiCall<{ granted?: string[]; ok?: boolean }>('/api/auth/feature-check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ features: ['cases.create', 'cases.edit', 'cases.delete'] }),
      })
      if (cancelled) return
      const granted = Array.isArray(call.result?.granted) ? call.result.granted : []
      const ok =
        call.result?.ok === true ||
        granted.includes('cases.create') ||
        granted.includes('cases.edit') ||
        granted.includes('cases.delete')
      setCanManage(ok)
    }
    void loadPerm()
    return () => {
      cancelled = true
    }
  }, [])

  const filters = React.useMemo<FilterDef[]>(
    () => [
      {
        id: 'statusValue',
        label: t('cases.list.filters.status', 'Status value'),
        type: 'text',
        placeholder: t('cases.list.filters.statusPlaceholder', 'e.g. open'),
      },
      {
        id: 'ownerUserId',
        label: t('cases.list.filters.ownerUserId', 'Owner user ID'),
        type: 'text',
        placeholder: t('cases.list.filters.uuidPlaceholder', 'UUID'),
      },
      {
        id: 'customerEntityId',
        label: t('cases.list.filters.customerEntityId', 'Customer entity ID'),
        type: 'text',
        placeholder: t('cases.list.filters.uuidPlaceholder', 'UUID'),
      },
    ],
    [t],
  )

  const queryParams = React.useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (search.trim()) params.set('search', search.trim())
    const status = filterValues.statusValue
    if (typeof status === 'string' && status.trim()) params.set('statusValue', status.trim())
    const owner = filterValues.ownerUserId
    if (typeof owner === 'string' && owner.trim()) params.set('ownerUserId', owner.trim())
    const customer = filterValues.customerEntityId
    if (typeof customer === 'string' && customer.trim()) params.set('customerEntityId', customer.trim())
    return params.toString()
  }, [filterValues.customerEntityId, filterValues.ownerUserId, filterValues.statusValue, page, search])

  const handleFiltersApply = React.useCallback((values: FilterValues) => {
    const next: FilterValues = {}
    Object.entries(values).forEach(([key, value]) => {
      if (value !== undefined) next[key] = value
    })
    setFilterValues(next)
    setPage(1)
  }, [])

  const handleFiltersClear = React.useCallback(() => {
    setFilterValues({})
    setPage(1)
  }, [])

  const handleRefresh = React.useCallback(() => {
    setReloadToken((x) => x + 1)
  }, [])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const call = await apiCall<ListResponse>(`/api/cases?${queryParams}`)
        if (cancelled) return
        if (!call.ok || !call.result) {
          flash(t('cases.list.errors.load', 'Failed to load cases.'), 'error')
          setRows([])
          return
        }
        setRows(Array.isArray(call.result.items) ? call.result.items : [])
        setTotalPages(typeof call.result.totalPages === 'number' ? call.result.totalPages : 1)
        setTotal(typeof call.result.total === 'number' ? call.result.total : 0)
      } catch {
        if (!cancelled) flash(t('cases.list.errors.load', 'Failed to load cases.'), 'error')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [queryParams, reloadToken, scopeVersion, t])

  const handleDelete = React.useCallback(
    async (row: CaseRow) => {
      if (!row?.id) return
      const ok = await confirm({
        title: t('cases.list.deleteTitle', 'Delete case?'),
        text: t('cases.list.deleteMessage', 'This will soft-delete the case.'),
        confirmText: t('common.delete', 'Delete'),
        variant: 'destructive',
      })
      if (!ok) return
      const result = await deleteCrud('cases', { id: row.id })
      if (!result.ok) {
        flash(t('cases.list.errors.delete', 'Could not delete case.'), 'error')
        return
      }
      flash(t('cases.list.deleted', 'Case deleted.'), 'success')
      setReloadToken((x) => x + 1)
    },
    [confirm, t],
  )

  const openDetail = React.useCallback(
    (id: string) => {
      router.push(`/backend/cases/${encodeURIComponent(id)}`)
    },
    [router],
  )

  const columns = React.useMemo<ColumnDef<CaseRow>[]>(
    () => [
      {
        accessorKey: 'title',
        header: t('cases.list.columns.title', 'Title'),
        cell: ({ row }) => (
          <Link
            href={`/backend/cases/${encodeURIComponent(row.original.id)}`}
            className="font-medium hover:underline"
          >
            {row.original.title}
          </Link>
        ),
      },
      {
        accessorKey: 'statusValue',
        header: t('cases.list.columns.status', 'Status'),
        cell: ({ row }) => <CaseStatusBadge statusValue={row.original.statusValue} />,
      },
      {
        id: 'customer',
        header: t('cases.list.columns.customer', 'Customer'),
        cell: ({ row }) => {
          const name = row.original.customerDisplayName?.trim()
          return <span className="text-sm">{name || '—'}</span>
        },
      },
    ],
    [t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable<CaseRow>
          title={t('cases.list.title', 'Cases')}
          refreshButton={{
            label: t('cases.list.refresh', 'Refresh'),
            onRefresh: () => {
              setSearch('')
              setPage(1)
              handleRefresh()
            },
          }}
          actions={
            canManage ? (
              <Button type="button" asChild size="sm" className="inline-flex items-center gap-2">
                <Link href="/backend/cases/create">
                  <Plus className="size-4 shrink-0" aria-hidden />
                  {t('cases.create.title', 'New case')}
                </Link>
              </Button>
            ) : null
          }
          columns={columns}
          data={rows}
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          searchPlaceholder={t('cases.list.searchPlaceholder', 'Search cases…')}
          filters={filters}
          filterValues={filterValues}
          onFiltersApply={handleFiltersApply}
          onFiltersClear={handleFiltersClear}
          perspective={{ tableId: 'cases.list' }}
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  id: 'view',
                  label: t('cases.list.actions.viewDetails', 'View details'),
                  onSelect: () => openDetail(row.id),
                },
                {
                  id: 'open-new-tab',
                  label: t('cases.list.actions.openInNewTab', 'Open in new tab'),
                  onSelect: () =>
                    window.open(`/backend/cases/${encodeURIComponent(row.id)}`, '_blank', 'noopener,noreferrer'),
                },
                ...(canManage
                  ? [
                      {
                        id: 'delete',
                        label: t('common.delete', 'Delete'),
                        destructive: true as const,
                        onSelect: () => void handleDelete(row),
                      },
                    ]
                  : []),
              ]}
            />
          )}
          pagination={{ page, pageSize: PAGE_SIZE, total, totalPages, onPageChange: setPage }}
          isLoading={isLoading}
          onRowClick={(row) => openDetail(row.id)}
        />
      </PageBody>
      {ConfirmDialogElement}
    </Page>
  )
}
