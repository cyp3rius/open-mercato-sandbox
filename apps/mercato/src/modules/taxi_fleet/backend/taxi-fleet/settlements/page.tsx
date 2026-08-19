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
import { useFleetDriverDirectory } from '../../../components/useFleetDriverDirectory'
import { useTaxiFleetPermissions } from '../../../components/useTaxiFleetPermissions'
import { SettlementGenerateDialog } from '../../../components/SettlementGenerateDialog'
import { SettlementStatusBadge } from '../../../components/SettlementStatusBadge'
import { formatSettlementMoney } from '../../../lib/settlementPayoutDisplay'
import { formatWeekRange } from '../../../lib/weekUtils'

const PAGE_SIZE = 20

type SettlementRow = {
  id: string
  teamMemberId: string
  weekStart: string
  status: string
  revenueNet?: string
  costsNet?: string
}

type ListResponse = { items: SettlementRow[]; totalPages: number; total?: number }

export default function TaxiFleetSettlementsPage() {
  const t = useT()
  const router = useRouter()
  const scopeVersion = useOrganizationScopeVersion()
  const { resolveName } = useFleetDriverDirectory()
  const { canManageSettlements } = useTaxiFleetPermissions()
  const [rows, setRows] = React.useState<SettlementRow[]>([])
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [filterValues, setFilterValues] = React.useState<FilterValues>({})
  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)
  const [generateOpen, setGenerateOpen] = React.useState(false)

  const filters = React.useMemo<FilterDef[]>(
    () => [
      {
        id: 'status',
        label: t('taxi_fleet.settlements.status', 'Status'),
        type: 'select',
        options: ['draft', 'submitted', 'approved', 'paid'].map((status) => ({
          value: status,
          label: t(`taxi_fleet.settlements.statuses.${status}`, status),
        })),
      },
    ],
    [t],
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
      const call = await apiCall<ListResponse>(`/api/taxi_fleet/settlements?${queryParams}`)
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

  const detailHref = (id: string) => `${TAXI_FLEET_BASE}/settlements/${encodeURIComponent(id)}`

  const columns = React.useMemo<ColumnDef<SettlementRow>[]>(
    () => [
      {
        accessorKey: 'weekStart',
        header: t('taxi_fleet.settlements.week', 'Week'),
        cell: ({ row }) => (
          <Link href={detailHref(row.original.id)} className="font-medium hover:underline tabular-nums">
            {formatWeekRange(row.original.weekStart)}
          </Link>
        ),
      },
      {
        accessorKey: 'teamMemberId',
        header: t('taxi_fleet.settlements.driver', 'Driver'),
        cell: ({ row }) => resolveName(row.original.teamMemberId),
      },
      {
        accessorKey: 'status',
        header: t('taxi_fleet.settlements.status', 'Status'),
        cell: ({ row }) => <SettlementStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'revenueNet',
        header: t('taxi_fleet.settlements.revenueNet', 'Revenue net'),
        cell: ({ row }) => formatSettlementMoney(row.original.revenueNet),
      },
      {
        accessorKey: 'costsNet',
        header: t('taxi_fleet.settlements.costsNet', 'Costs net'),
        cell: ({ row }) => formatSettlementMoney(row.original.costsNet),
      },
    ],
    [resolveName, t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable<SettlementRow>
          title={t('taxi_fleet.settlements.weeklyList.title', 'Weekly settlements')}
          refreshButton={{
            label: t('taxi_fleet.settlements.list.actions.refresh', 'Refresh'),
            onRefresh: () => {
              setPage(1)
              setReloadToken((value) => value + 1)
            },
          }}
          actions={
            canManageSettlements ? (
              <Button
                type="button"
                size="sm"
                className="inline-flex items-center gap-2"
                onClick={() => setGenerateOpen(true)}
              >
                <Plus className="size-4 shrink-0" aria-hidden />
                {t('taxi_fleet.settlements.actions.generate', 'Generate settlement')}
              </Button>
            ) : null
          }
          columns={columns}
          data={rows}
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
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  id: 'view',
                  label: t('taxi_fleet.settlements.list.actions.viewDetails', 'View details'),
                  onSelect: () => router.push(detailHref(row.id)),
                },
                {
                  id: 'open-tab',
                  label: t('taxi_fleet.settlements.list.actions.openInNewTab', 'Open in new tab'),
                  onSelect: () => window.open(detailHref(row.id), '_blank', 'noopener,noreferrer'),
                },
              ]}
            />
          )}
          onRowClick={(row) => router.push(detailHref(row.id))}
          isLoading={isLoading}
          emptyState={t('taxi_fleet.settlements.empty', 'No settlements yet.')}
          pagination={{ page, totalPages, total, pageSize: PAGE_SIZE, onPageChange: setPage }}
          perspective={{ tableId: 'taxi_fleet.settlements' }}
        />
        <SettlementGenerateDialog
          open={generateOpen}
          onOpenChange={setGenerateOpen}
          onGenerated={() => setReloadToken((value) => value + 1)}
        />
      </PageBody>
    </Page>
  )
}
