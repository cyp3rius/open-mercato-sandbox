"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { useTaxiFleetLabels, TAXI_FLEET_TRIP_TYPES } from '../../../components/useTaxiFleetLabels'
import { useTaxiFleetPermissions } from '../../../components/useTaxiFleetPermissions'
import { useFleetBackendSession } from '../../../components/useFleetBackendSession'
import { TripCustomerPreview } from '../../../components/TripCustomerPreview'
import { useTripStatusDictionary } from '../../../components/useTripStatusDictionary'
import { DictionaryAppearancePreview } from '@open-mercato/core/modules/dictionaries/components/dictionaryAppearance'

const PAGE_SIZE = 20

type TripRow = {
  id: string
  tripType: string
  status: string
  teamMemberId?: string | null
  customerPersonId?: string | null
  customerCompanyId?: string | null
  revenueAmount?: string | null
  startedAt?: string | null
}

type ListResponse = { items: TripRow[]; totalPages: number; total?: number }

export default function TaxiFleetTripsPage() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const scopeVersion = useOrganizationScopeVersion()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const { resolveName } = useFleetDriverDirectory()
  const { resolveTripTypeLabel } = useTaxiFleetLabels()
  const { statusOptions, findDefinition } = useTripStatusDictionary()
  const { canManageTrips } = useTaxiFleetPermissions()
  const { isDriverOnly } = useFleetBackendSession()
  const [rows, setRows] = React.useState<TripRow[]>([])
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const unscheduledOnly = searchParams.get('unscheduled') === '1' || searchParams.get('unscheduled') === 'true'

  const [filterValues, setFilterValues] = React.useState<FilterValues>(() =>
    unscheduledOnly ? { unscheduled: 'true' } : {},
  )

  React.useEffect(() => {
    if (unscheduledOnly) {
      setFilterValues((current) => (current.unscheduled === 'true' ? current : { ...current, unscheduled: 'true' }))
    }
  }, [unscheduledOnly])
  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)

  const filters = React.useMemo<FilterDef[]>(
    () => {
      const items: FilterDef[] = []
      if (!isDriverOnly) {
        items.push({
          id: 'unscheduled',
          label: t('taxi_fleet.trips.unscheduledFilter', 'Awaiting scheduling only'),
          type: 'select',
          options: [
            { value: 'true', label: t('common.yes', 'Yes') },
            { value: 'false', label: t('common.no', 'No') },
          ],
        })
      }
      items.push(
        {
          id: 'status',
          label: t('taxi_fleet.trips.status', 'Status'),
          type: 'select',
          options: statusOptions,
        },
        {
          id: 'tripType',
          label: t('taxi_fleet.trips.type', 'Type'),
          type: 'select',
          options: TAXI_FLEET_TRIP_TYPES.map((type) => ({
            value: type,
            label: t(`taxi_fleet.trips.types.${type}`, type),
          })),
        },
      )
      return items
    },
    [isDriverOnly, statusOptions, t],
  )

  const queryParams = React.useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    const unscheduled = filterValues.unscheduled
    if (unscheduled === 'true' || unscheduled === true) params.set('unscheduled', 'true')
    const status = filterValues.status
    if (typeof status === 'string' && status.trim()) params.set('status', status.trim())
    const tripType = filterValues.tripType
    if (typeof tripType === 'string' && tripType.trim()) params.set('tripType', tripType.trim())
    return params.toString()
  }, [filterValues.status, filterValues.tripType, filterValues.unscheduled, page])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      const call = await apiCall<ListResponse>(`/api/taxi_fleet/trips?${queryParams}`)
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

  const detailHref = (id: string) => `${TAXI_FLEET_BASE}/trips/${encodeURIComponent(id)}`

  const handleDelete = React.useCallback(
    async (row: TripRow) => {
      const confirmed = await confirm({
        title: t('taxi_fleet.trips.list.deleteConfirm', 'Delete this trip?'),
        variant: 'destructive',
      })
      if (!confirmed) return
      await deleteCrud('taxi_fleet/trips', row.id, {
        errorMessage: t('taxi_fleet.trips.list.deleteError', 'Failed to delete trip.'),
      })
      flash(t('taxi_fleet.trips.list.deleteSuccess', 'Trip deleted.'), 'success')
      setReloadToken((value) => value + 1)
    },
    [confirm, t],
  )

  const columns = React.useMemo<ColumnDef<TripRow>[]>(
    () => [
      {
        accessorKey: 'tripType',
        header: t('taxi_fleet.trips.type', 'Type'),
        cell: ({ row }) => (
          <Link href={detailHref(row.original.id)} className="font-medium hover:underline">
            {resolveTripTypeLabel(row.original.tripType)}
          </Link>
        ),
      },
      {
        accessorKey: 'status',
        header: t('taxi_fleet.trips.status', 'Status'),
        cell: ({ row }) => {
          const definition = findDefinition(row.original.status)
          return (
            <DictionaryAppearancePreview
              color={definition?.color}
              icon={definition?.icon}
              label={definition?.label ?? row.original.status}
              labelClassName="text-sm"
            />
          )
        },
      },
      {
        accessorKey: 'teamMemberId',
        header: t('taxi_fleet.trips.driver', 'Driver'),
        cell: ({ row }) =>
          row.original.teamMemberId
            ? resolveName(row.original.teamMemberId)
            : t('taxi_fleet.trips.unassigned', 'Unassigned'),
      },
      {
        id: 'customer',
        header: t('taxi_fleet.trips.customer', 'Customer'),
        cell: ({ row }) => (
          <TripCustomerPreview
            customerPersonId={row.original.customerPersonId}
            customerCompanyId={row.original.customerCompanyId}
          />
        ),
      },
      { accessorKey: 'revenueAmount', header: t('taxi_fleet.trips.revenue', 'Revenue') },
      { accessorKey: 'startedAt', header: t('taxi_fleet.trips.started', 'Started') },
    ],
    [findDefinition, resolveName, resolveTripTypeLabel, t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable<TripRow>
          title={t('taxi_fleet.trips.list.title', 'Trips')}
          refreshButton={{
            label: t('taxi_fleet.trips.list.actions.refresh', 'Refresh'),
            onRefresh: () => {
              setPage(1)
              setReloadToken((value) => value + 1)
            },
          }}
          actions={
            canManageTrips ? (
              <Button asChild type="button" size="sm" className="inline-flex items-center gap-2">
                <Link href={`${TAXI_FLEET_BASE}/trips/create`}>
                  <Plus className="size-4 shrink-0" aria-hidden />
                  {t('taxi_fleet.trips.actions.new', 'New trip')}
                </Link>
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
                  label: t('taxi_fleet.trips.list.actions.viewDetails', 'View details'),
                  onSelect: () => router.push(detailHref(row.id)),
                },
                {
                  id: 'open-tab',
                  label: t('taxi_fleet.trips.list.actions.openInNewTab', 'Open in new tab'),
                  onSelect: () => window.open(detailHref(row.id), '_blank', 'noopener,noreferrer'),
                },
                ...(canManageTrips
                  ? [
                      {
                        id: 'delete',
                        label: t('taxi_fleet.trips.list.actions.delete', 'Delete'),
                        destructive: true as const,
                        onSelect: () => void handleDelete(row),
                      },
                    ]
                  : []),
              ]}
            />
          )}
          onRowClick={(row) => router.push(detailHref(row.id))}
          isLoading={isLoading}
          emptyState={t('taxi_fleet.trips.empty', 'No trips yet.')}
          pagination={{ page, totalPages, total, pageSize: PAGE_SIZE, onPageChange: setPage }}
          perspective={{ tableId: 'taxi_fleet.trips' }}
        />
      </PageBody>
      {ConfirmDialogElement}
    </Page>
  )
}
