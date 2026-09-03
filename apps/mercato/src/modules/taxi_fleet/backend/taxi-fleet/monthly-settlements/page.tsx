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
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { TAXI_FLEET_BASE } from '../paths'
import { useTaxiFleetPermissions } from '../../../components/useTaxiFleetPermissions'
import { MonthlySettlementGenerateDialog } from '../../../components/MonthlySettlementGenerateDialog'

const PAGE_SIZE = 20

type MonthlySettlementRow = {
  id: string
  monthStart: string
  status: string
  revenueNet?: string
  transferAmount?: string
  weeklyCount?: number
  driverCount?: number
}

type ListResponse = { items: MonthlySettlementRow[]; totalPages: number; total?: number }

function formatMonthLabel(monthStart: string): string {
  return monthStart.slice(0, 7)
}

export default function TaxiFleetMonthlySettlementsPage() {
  const t = useT()
  const router = useRouter()
  const scopeVersion = useOrganizationScopeVersion()
  const { canManageSettlements } = useTaxiFleetPermissions()
  const [rows, setRows] = React.useState<MonthlySettlementRow[]>([])
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [filterValues, setFilterValues] = React.useState<FilterValues>({})
  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)
  const [generateOpen, setGenerateOpen] = React.useState(false)

  const resolveStatusLabel = React.useCallback(
    (status: string) => t(`taxi_fleet.monthlySettlements.statuses.${status}`, status),
    [t],
  )

  const filters = React.useMemo<FilterDef[]>(
    () => [
      {
        id: 'status',
        label: t('taxi_fleet.settlements.status', 'Status'),
        type: 'select',
        options: ['draft', 'approved', 'closed'].map((status) => ({
          value: status,
          label: resolveStatusLabel(status),
        })),
      },
    ],
    [resolveStatusLabel, t],
  )

  const queryParams = React.useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    const status = filterValues.status
    if (typeof status === 'string' && status.trim()) params.set('status', status.trim())
    return params.toString()
  }, [filterValues.status, page])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      const call = await apiCall<ListResponse>(`/api/taxi_fleet/monthly-settlements?${queryParams}`)
      if (cancelled) return
      setRows(Array.isArray(call.result?.items) ? call.result.items : [])
      setTotalPages(call.result?.totalPages ?? 1)
      setTotal(call.result?.total ?? call.result?.items?.length ?? 0)
      setIsLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [queryParams, reloadToken, scopeVersion])

  const detailHref = (id: string) => `${TAXI_FLEET_BASE}/monthly-settlements/${encodeURIComponent(id)}`

  const columns = React.useMemo<ColumnDef<MonthlySettlementRow>[]>(
    () => [
      {
        accessorKey: 'monthStart',
        header: t('taxi_fleet.monthlySettlements.month', 'Month'),
        cell: ({ row }) => (
          <Link href={detailHref(row.original.id)} className="font-medium hover:underline">
            {formatMonthLabel(row.original.monthStart)}
          </Link>
        ),
      },
      {
        accessorKey: 'status',
        header: t('taxi_fleet.settlements.status', 'Status'),
        cell: ({ row }) => resolveStatusLabel(row.original.status),
      },
      {
        accessorKey: 'driverCount',
        header: t('taxi_fleet.monthlySettlements.driverCount', 'Drivers'),
        cell: ({ row }) => row.original.driverCount ?? '—',
      },
      {
        accessorKey: 'weeklyCount',
        header: t('taxi_fleet.monthlySettlements.weeklyCount', 'Weeks'),
        cell: ({ row }) => row.original.weeklyCount ?? '—',
      },
      {
        accessorKey: 'revenueNet',
        header: t('taxi_fleet.settlements.revenueNet', 'Revenue net'),
        cell: ({ row }) => row.original.revenueNet ?? '—',
      },
      {
        accessorKey: 'transferAmount',
        header: t('taxi_fleet.settlements.transferAmount', 'Transfer payout'),
        cell: ({ row }) => row.original.transferAmount ?? '—',
      },
    ],
    [resolveStatusLabel, t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable<MonthlySettlementRow>
          title={t('taxi_fleet.monthlySettlements.list.title', 'Monthly settlements')}
          refreshButton={{
            label: t('taxi_fleet.settlements.list.actions.refresh', 'Refresh'),
            onRefresh: () => {
              setPage(1)
              setReloadToken((value) => value + 1)
            },
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
          pagination={{ page, totalPages, total, pageSize: PAGE_SIZE, onPageChange: setPage }}
          onRowClick={(row) => router.push(detailHref(row.id))}
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  id: 'open',
                  label: t('taxi_fleet.settlements.list.actions.viewDetails', 'View details'),
                  onSelect: () => router.push(detailHref(row.id)),
                },
              ]}
            />
          )}
          actions={
            canManageSettlements ? (
              <Button type="button" onClick={() => setGenerateOpen(true)}>
                <Plus className="mr-2 size-4" aria-hidden />
                {t('taxi_fleet.monthlySettlements.actions.generate', 'Generate monthly settlement')}
              </Button>
            ) : null
          }
        />
        <MonthlySettlementGenerateDialog
          open={generateOpen}
          onOpenChange={setGenerateOpen}
          onGenerated={() => {
            setPage(1)
            setReloadToken((value) => value + 1)
          }}
        />
      </PageBody>
    </Page>
  )
}
