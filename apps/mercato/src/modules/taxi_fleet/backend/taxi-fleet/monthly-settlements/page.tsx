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
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { TAXI_FLEET_BASE } from '../paths'
import { useFleetDriverDirectory } from '../../../components/useFleetDriverDirectory'
import { useTaxiFleetPermissions } from '../../../components/useTaxiFleetPermissions'
import { MonthlySettlementGenerateDialog } from '../../../components/MonthlySettlementGenerateDialog'
import { SettlementStatusBadge } from '../../../components/SettlementStatusBadge'
import { formatSettlementMoney } from '../../../lib/settlementPayoutDisplay'
import { canDeleteMonthlySettlement } from '../../../lib/settlementStatusTransitions'

const PAGE_SIZE = 20

type MonthlySettlementRow = {
  id: string
  teamMemberId: string
  monthStart: string
  status: string
  revenueNet?: string
  costsNet?: string
  payoutAmount?: string
  transferAmount?: string
  weeklyCount?: number
}

type ListResponse = { items: MonthlySettlementRow[]; totalPages: number; total?: number }

function formatMonthLabel(monthStart: string): string {
  return monthStart.slice(0, 7)
}

export default function TaxiFleetMonthlySettlementsPage() {
  const t = useT()
  const router = useRouter()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const scopeVersion = useOrganizationScopeVersion()
  const { resolveName } = useFleetDriverDirectory()
  const { canManageSettlements } = useTaxiFleetPermissions()
  const [rows, setRows] = React.useState<MonthlySettlementRow[]>([])
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
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      sortField: 'monthStart',
      sortDir: 'desc',
    })
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

  const handleDelete = React.useCallback(
    async (settlement: MonthlySettlementRow) => {
      const ok = await confirm({
        title: t('taxi_fleet.monthlySettlements.list.deleteConfirm', 'Delete this draft monthly settlement?'),
        variant: 'destructive',
      })
      if (!ok) return
      await deleteCrud('taxi_fleet/monthly-settlements', settlement.id, {
        errorMessage: t('taxi_fleet.monthlySettlements.list.deleteError', 'Could not delete monthly settlement.'),
      })
      flash(t('taxi_fleet.monthlySettlements.list.deleteSuccess', 'Monthly settlement deleted.'), 'success')
      setReloadToken((value) => value + 1)
    },
    [confirm, t],
  )

  const columns = React.useMemo<ColumnDef<MonthlySettlementRow>[]>(
    () => [
      {
        accessorKey: 'monthStart',
        header: t('taxi_fleet.monthlySettlements.month', 'Month'),
        cell: ({ row }) => (
          <Link href={detailHref(row.original.id)} className="font-medium hover:underline tabular-nums">
            {formatMonthLabel(row.original.monthStart)}
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
        accessorKey: 'payoutAmount',
        header: t('taxi_fleet.settlements.payout', 'Payout'),
        cell: ({ row }) => formatSettlementMoney(row.original.payoutAmount),
      },
      {
        accessorKey: 'weeklyCount',
        header: t('taxi_fleet.monthlySettlements.weeklyCount', 'Weeks'),
        cell: ({ row }) => row.original.weeklyCount ?? '—',
      },
    ],
    [resolveName, t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('taxi_fleet.monthlySettlements.list.title', 'Monthly settlements (payout)')}
          description={t(
            'taxi_fleet.monthlySettlements.list.description',
            'Per-driver calendar-month settlements used for actual payouts. Weekly settlements remain control-only.',
          )}
          refreshButton={{
            label: t('common.refresh', 'Refresh'),
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
          perspective={{ tableId: 'taxi-fleet-monthly-settlements' }}
          onRowClick={(row) => router.push(detailHref(row.id))}
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  label: t('taxi_fleet.settlements.list.actions.viewDetails', 'View details'),
                  onSelect: () => router.push(detailHref(row.id)),
                },
                ...(canManageSettlements && canDeleteMonthlySettlement(row.status)
                  ? [
                      {
                        label: t('common.delete', 'Delete'),
                        destructive: true as const,
                        onSelect: () => void handleDelete(row),
                      },
                    ]
                  : []),
              ]}
            />
          )}
          actions={
            canManageSettlements ? (
              <Button type="button" size="sm" className="inline-flex items-center gap-2" onClick={() => setGenerateOpen(true)}>
                <Plus className="size-4" aria-hidden />
                {t('taxi_fleet.monthlySettlements.generate', 'Generate month')}
              </Button>
            ) : null
          }
        />
        <MonthlySettlementGenerateDialog
          open={generateOpen}
          onOpenChange={setGenerateOpen}
          onGenerated={() => setReloadToken((value) => value + 1)}
        />
        {ConfirmDialogElement}
      </PageBody>
    </Page>
  )
}
