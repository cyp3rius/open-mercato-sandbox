'use client'

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
import { Badge } from '@open-mercato/ui/primitives/badge'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { parseNumericValue, formatMoneyDisplay } from '@open-mercato/shared/lib/numeric'
import { formatDiscountCodeListValue } from '../../../components/discountCodeFormConfig'
import { TAXI_FLEET_BASE } from '../paths'

const PAGE_SIZE = 20

type DiscountCodeRow = {
  id: string
  code: string
  label?: string | null
  discountType: 'percent' | 'amount'
  value: string
  usageLimit?: string | null
  usedAmount?: string | null
  active: boolean
  createdAt?: string | null
}

type ListResponse = { items: DiscountCodeRow[]; totalPages: number; total?: number }

export default function TaxiFleetDiscountCodesPage() {
  const t = useT()
  const router = useRouter()
  const scopeVersion = useOrganizationScopeVersion()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [rows, setRows] = React.useState<DiscountCodeRow[]>([])
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)
  const [search, setSearch] = React.useState('')
  const [filterValues, setFilterValues] = React.useState<FilterValues>({})

  const filters = React.useMemo<FilterDef[]>(
    () => [
      {
        id: 'active',
        label: t('taxi_fleet.discount_codes.list.filters.active', 'Status'),
        type: 'select',
        options: [
          { value: 'true', label: t('taxi_fleet.discount_codes.list.filters.activeOnly', 'Active') },
          { value: 'false', label: t('taxi_fleet.discount_codes.list.filters.inactiveOnly', 'Inactive') },
        ],
      },
    ],
    [t],
  )

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        sortField: 'createdAt',
        sortDir: 'desc',
      })
      const searchTerm = search.trim()
      if (searchTerm) params.set('search', searchTerm)
      const activeFilter = filterValues.active
      if (typeof activeFilter === 'string' && activeFilter.trim()) {
        params.set('active', activeFilter.trim())
      }

      const call = await apiCall<ListResponse>(`/api/taxi_fleet/discount-codes?${params}`)
      if (cancelled) return
      const items = Array.isArray(call.result?.items) ? call.result.items : []
      setRows(items)
      setTotalPages(call.result?.totalPages ?? 1)
      setTotal(call.result?.total ?? items.length)
      setIsLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [page, reloadToken, scopeVersion, filterValues, search])

  const columns = React.useMemo<ColumnDef<DiscountCodeRow>[]>(
    () => [
      {
        accessorKey: 'code',
        header: t('taxi_fleet.discount_codes.list.columns.code', 'Code'),
        cell: ({ row }) => (
          <Link
            href={`${TAXI_FLEET_BASE}/discount-codes/${row.original.id}`}
            className="font-medium text-primary hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {row.original.code}
          </Link>
        ),
      },
      {
        accessorKey: 'label',
        header: t('taxi_fleet.discount_codes.list.columns.label', 'Label'),
        cell: ({ row }) => row.original.label?.trim() || '—',
      },
      {
        id: 'value',
        header: t('taxi_fleet.discount_codes.list.columns.value', 'Value'),
        cell: ({ row }) => formatDiscountCodeListValue(row.original),
      },
      {
        id: 'pool',
        header: t('taxi_fleet.discount_codes.list.columns.pool', 'Pool'),
        cell: ({ row }) => {
          if (row.original.discountType !== 'amount') return '—'
          const limit = parseNumericValue(row.original.usageLimit)
          const used = parseNumericValue(row.original.usedAmount) ?? 0
          if (limit == null) return '—'
          const remaining = Math.max(0, limit - used)
          return formatMoneyDisplay(remaining, { currency: 'PLN' })
        },
      },
      {
        accessorKey: 'active',
        header: t('taxi_fleet.discount_codes.list.columns.active', 'Active'),
        cell: ({ row }) => (
          <Badge variant={row.original.active ? 'secondary' : 'outline'}>
            {row.original.active
              ? t('taxi_fleet.discount_codes.list.activeYes', 'Active')
              : t('taxi_fleet.discount_codes.list.activeNo', 'Inactive')}
          </Badge>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: t('taxi_fleet.discount_codes.list.columns.createdAt', 'Created'),
        cell: ({ row }) =>
          row.original.createdAt ? new Date(row.original.createdAt).toLocaleString() : '—',
      },
    ],
    [t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('taxi_fleet.discount_codes.list.title', 'Discount codes')}
          description={t(
            'taxi_fleet.discount_codes.list.description',
            'Promotional codes for trip pricing (inject / checkout).',
          )}
          refreshButton={{
            label: t('taxi_fleet.discount_codes.list.actions.refresh', 'Refresh'),
            onRefresh: () => {
              setPage(1)
              setReloadToken((token) => token + 1)
            },
          }}
          actions={
            <Button asChild size="sm" className="inline-flex items-center gap-2">
              <Link href={`${TAXI_FLEET_BASE}/discount-codes/create`}>
                <Plus className="size-4" aria-hidden />
                {t('taxi_fleet.discount_codes.list.actions.create', 'New code')}
              </Link>
            </Button>
          }
          searchPlaceholder={t('taxi_fleet.discount_codes.list.search', 'Search code or label…')}
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          filters={filters}
          filterValues={filterValues}
          onFiltersApply={(values) => {
            setFilterValues(values)
            setPage(1)
          }}
          onFiltersClear={() => {
            setFilterValues({})
            setPage(1)
          }}
          columns={columns}
          data={rows}
          isLoading={isLoading}
          emptyState={t('taxi_fleet.discount_codes.list.empty', 'No discount codes yet.')}
          perspective={{ tableId: 'taxi_fleet.discount_codes' }}
          pagination={{
            page,
            pageSize: PAGE_SIZE,
            total,
            totalPages,
            onPageChange: setPage,
          }}
          onRowClick={(row) => router.push(`${TAXI_FLEET_BASE}/discount-codes/${row.id}`)}
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  id: 'open',
                  label: t('taxi_fleet.discount_codes.list.actions.viewDetails', 'View details'),
                  onSelect: () => router.push(`${TAXI_FLEET_BASE}/discount-codes/${row.id}`),
                },
                {
                  id: 'open-tab',
                  label: t('taxi_fleet.discount_codes.list.actions.openInNewTab', 'Open in new tab'),
                  onSelect: () =>
                    window.open(
                      `${TAXI_FLEET_BASE}/discount-codes/${row.id}`,
                      '_blank',
                      'noopener,noreferrer',
                    ),
                },
                {
                  id: 'delete',
                  label: t('taxi_fleet.discount_codes.list.actions.delete', 'Delete'),
                  destructive: true,
                  onSelect: async () => {
                    const ok = await confirm({
                      text: t(
                        'taxi_fleet.discount_codes.list.deleteConfirm',
                        'Delete this discount code?',
                      ),
                      confirmText: t('common.delete', 'Delete'),
                      variant: 'destructive',
                    })
                    if (!ok) return
                    try {
                      await deleteCrud('taxi_fleet/discount-codes', row.id)
                      flash(t('taxi_fleet.discount_codes.list.deleteSuccess', 'Deleted.'), 'success')
                      setReloadToken((token) => token + 1)
                    } catch {
                      flash(t('taxi_fleet.errors.generic', 'Operation failed.'), 'error')
                    }
                  },
                },
              ]}
            />
          )}
        />
      </PageBody>
      {ConfirmDialogElement}
    </Page>
  )
}
