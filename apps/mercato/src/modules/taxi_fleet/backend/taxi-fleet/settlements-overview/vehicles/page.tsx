'use client'

import * as React from 'react'
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
import { TAXI_FLEET_BASE } from '../../paths'
import { useTaxiFleetPermissions } from '../../../../components/useTaxiFleetPermissions'
import { useResourceLabels } from '../../../../components/useResourceLabels'
import { SettlementStatusBadge } from '../../../../components/SettlementStatusBadge'
import { VehicleMonthlySettlementGenerateDialog } from '../../../../components/VehicleMonthlySettlementGenerateDialog'
import { formatSettlementMoney } from '../../../../lib/settlementPayoutDisplay'
import { canDeleteVehicleMonthlySettlement } from '../../../../lib/settlementStatusTransitions'
import { computeCashVariance } from '../../../../lib/settlementCashVariance'

const PAGE_SIZE = 20

type Row = {
  id: string
  resourceId: string
  monthStart: string
  status: string
  cashExpected?: string
  cashReported?: string
  shiftGpsKm?: string
}

type ListResponse = { items: Row[]; totalPages: number; total?: number }

function detailHref(id: string) {
  return `${TAXI_FLEET_BASE}/vehicle-monthly-settlements/${encodeURIComponent(id)}`
}

export default function TaxiFleetVehicleMonthlySettlementsPage() {
  const t = useT()
  const router = useRouter()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const scopeVersion = useOrganizationScopeVersion()
  const { canManageSettlements } = useTaxiFleetPermissions()
  const [rows, setRows] = React.useState<Row[]>([])
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [filterValues, setFilterValues] = React.useState<FilterValues>({})
  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)
  const [generateOpen, setGenerateOpen] = React.useState(false)

  const resourceIds = React.useMemo(
    () => [...new Set(rows.map((row) => row.resourceId).filter(Boolean))],
    [rows],
  )
  const { resolveLabel } = useResourceLabels(resourceIds)

  const filters = React.useMemo<FilterDef[]>(
    () => [
      {
        id: 'status',
        label: t('taxi_fleet.vehicleMonthlySettlements.status', 'Status'),
        type: 'select',
        options: ['draft', 'approved'].map((status) => ({
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
      const call = await apiCall<ListResponse>(`/api/taxi_fleet/vehicle-monthly-settlements?${queryParams}`)
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

  async function handleDelete(row: Row) {
    const ok = await confirm({
      title: t('taxi_fleet.vehicleMonthlySettlements.deleteConfirm', 'Delete this draft vehicle settlement?'),
    })
    if (!ok) return
    await deleteCrud('taxi_fleet/vehicle-monthly-settlements', row.id, {
      errorMessage: t('taxi_fleet.vehicleMonthlySettlements.deleteError', 'Could not delete settlement.'),
    })
    flash(t('taxi_fleet.vehicleMonthlySettlements.deleteSuccess', 'Settlement deleted.'), 'success')
    setReloadToken((value) => value + 1)
  }

  const columns = React.useMemo<ColumnDef<Row>[]>(
    () => [
      {
        accessorKey: 'monthStart',
        header: t('taxi_fleet.vehicleMonthlySettlements.monthStart', 'Month'),
        cell: ({ row }) => row.original.monthStart.slice(0, 7),
      },
      {
        accessorKey: 'resourceId',
        header: t('taxi_fleet.vehicleMonthlySettlements.vehicle', 'Vehicle'),
        cell: ({ row }) => resolveLabel(row.original.resourceId),
      },
      {
        accessorKey: 'status',
        header: t('taxi_fleet.vehicleMonthlySettlements.status', 'Status'),
        cell: ({ row }) => <SettlementStatusBadge status={row.original.status} />,
      },
      {
        id: 'cashVariance',
        header: t('taxi_fleet.vehicleMonthlySettlements.cashVariance', 'Cash variance'),
        cell: ({ row }) =>
          formatSettlementMoney(
            computeCashVariance(
              Number(row.original.cashReported ?? 0),
              Number(row.original.cashExpected ?? 0),
            ),
          ),
      },
      {
        accessorKey: 'shiftGpsKm',
        header: t('taxi_fleet.vehicleMonthlySettlements.shiftGpsKm', 'GPS km'),
        cell: ({ row }) => row.original.shiftGpsKm ?? '0',
      },
    ],
    [resolveLabel, t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('taxi_fleet.vehicleMonthlySettlements.title', 'Vehicle monthly settlements')}
          description={t(
            'taxi_fleet.vehicleMonthlySettlements.description',
            'End-of-month vehicle FRE: GPS distance and cash register reconciliation.',
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
          perspective={{ tableId: 'taxi-fleet-vehicle-monthly-settlements' }}
          onRowClick={(row) => router.push(detailHref(row.id))}
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  label: t('taxi_fleet.settlements.list.actions.viewDetails', 'View details'),
                  onSelect: () => router.push(detailHref(row.id)),
                },
                ...(canManageSettlements && canDeleteVehicleMonthlySettlement(row.status)
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
              <Button
                type="button"
                size="sm"
                className="inline-flex items-center gap-2"
                onClick={() => setGenerateOpen(true)}
              >
                <Plus className="size-4" aria-hidden />
                {t('taxi_fleet.vehicleMonthlySettlements.actions.generate', 'Generate month')}
              </Button>
            ) : null
          }
        />
        <VehicleMonthlySettlementGenerateDialog
          open={generateOpen}
          onOpenChange={setGenerateOpen}
          onGenerated={() => setReloadToken((value) => value + 1)}
        />
        {ConfirmDialogElement}
      </PageBody>
    </Page>
  )
}
