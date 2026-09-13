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
import { Badge } from '@open-mercato/ui/primitives/badge'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { cn } from '@open-mercato/shared/lib/utils'
import { formatPercentDisplay } from '@open-mercato/shared/lib/numeric'
import { TAXI_FLEET_BASE } from '../paths'
import { useFleetDriverDirectory } from '../../../components/useFleetDriverDirectory'
import { useTaxiFleetPermissions } from '../../../components/useTaxiFleetPermissions'
import { useTaxiFleetSettings } from '../../../components/useTaxiFleetSettings'
import { useResourceLabels } from '../../../components/useResourceLabels'
import { remoteSearchFleetResources } from '../../../lib/fleetResourceSearch'

const PAGE_SIZE = 20

type DriverRow = {
  id: string
  teamMemberId: string
  payoutMode?: string
  payoutPercent: string
  payoutTiersJson?: unknown
  externalAppEnabled: boolean
  onShift?: boolean
  defaultResourceId?: string | null
  defaultResourceIds?: string[] | null
}

type ListResponse = { items: DriverRow[]; totalPages: number; total?: number }

export default function TaxiFleetDriversPage() {
  const t = useT()
  const router = useRouter()
  const scopeVersion = useOrganizationScopeVersion()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const { resolveName, reload: reloadDirectory } = useFleetDriverDirectory()
  const { canManageSettlements } = useTaxiFleetPermissions()
  const { resourceTypeId } = useTaxiFleetSettings()
  const [rows, setRows] = React.useState<DriverRow[]>([])
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)
  const [filterValues, setFilterValues] = React.useState<FilterValues>({})
  const [vehicleFilterOptions, setVehicleFilterOptions] = React.useState<
    Array<{ value: string; label: string }>
  >([])

  const selectedResourceId =
    typeof filterValues.resourceId === 'string' && filterValues.resourceId.length > 0
      ? filterValues.resourceId
      : null

  const resourceIds = React.useMemo(() => {
    const ids = new Set<string>()
    rows.forEach((row) => {
      const list = Array.isArray(row.defaultResourceIds) ? row.defaultResourceIds : []
      list.forEach((id) => {
        if (id) ids.add(id)
      })
      if (row.defaultResourceId) ids.add(row.defaultResourceId)
    })
    if (selectedResourceId) ids.add(selectedResourceId)
    return [...ids]
  }, [rows, selectedResourceId])
  const { resolveLabel: resolveResourceLabel } = useResourceLabels(resourceIds)

  React.useEffect(() => {
    let cancelled = false
    async function loadVehicleOptions() {
      const loaded = await remoteSearchFleetResources('', resourceTypeId)
      if (cancelled) return
      setVehicleFilterOptions(loaded.map((row) => ({ value: row.value, label: row.label })))
    }
    void loadVehicleOptions()
    return () => {
      cancelled = true
    }
  }, [resourceTypeId, scopeVersion])

  const filters = React.useMemo<FilterDef[]>(
    () => [
      {
        id: 'onShift',
        label: t('taxi_fleet.drivers.list.filters.onShift', 'Shift status'),
        type: 'select',
        options: [
          { value: 'true', label: t('taxi_fleet.drivers.list.filters.onShiftYes', 'On shift') },
          { value: 'false', label: t('taxi_fleet.drivers.list.filters.onShiftNo', 'Off shift') },
        ],
      },
      {
        id: 'name',
        label: t('taxi_fleet.drivers.list.filters.name', 'Name'),
        type: 'text',
        placeholder: t('taxi_fleet.drivers.list.filters.namePlaceholder', 'First and last name…'),
      },
      {
        id: 'externalAppEnabled',
        label: t('taxi_fleet.drivers.mobileApp', 'Mobile app'),
        type: 'select',
        options: [
          { value: 'true', label: t('common.yes', 'Yes') },
          { value: 'false', label: t('common.no', 'No') },
        ],
      },
      {
        id: 'resourceId',
        label: t('taxi_fleet.drivers.list.filters.vehicle', 'Vehicle'),
        type: 'combobox',
        options: vehicleFilterOptions,
        formatValue: (id) => resolveResourceLabel(id),
        loadOptions: async (query) => {
          const loaded = await remoteSearchFleetResources(query ?? '', resourceTypeId)
          return loaded.map((row) => ({ value: row.value, label: row.label }))
        },
        placeholder: t('taxi_fleet.drivers.vehicleSearch', 'Search vehicle…'),
      },
    ],
    [resolveResourceLabel, resourceTypeId, t, vehicleFilterOptions],
  )

  const queryParams = React.useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    })
    const onShift = filterValues.onShift
    if (onShift === 'true' || onShift === 'false') params.set('onShift', onShift)
    const name = filterValues.name
    if (typeof name === 'string' && name.trim()) params.set('name', name.trim())
    const externalAppEnabled = filterValues.externalAppEnabled
    if (externalAppEnabled === 'true' || externalAppEnabled === 'false') {
      params.set('externalAppEnabled', externalAppEnabled)
    }
    const resourceId = filterValues.resourceId
    if (typeof resourceId === 'string' && resourceId.trim()) {
      params.set('resourceId', resourceId.trim())
    }
    return params.toString()
  }, [
    filterValues.externalAppEnabled,
    filterValues.name,
    filterValues.onShift,
    filterValues.resourceId,
    page,
  ])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      const call = await apiCall<ListResponse>(`/api/taxi_fleet/driver-profiles?${queryParams}`)
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

  const detailHref = (id: string) => `${TAXI_FLEET_BASE}/drivers/${encodeURIComponent(id)}`

  const handleRefresh = React.useCallback(() => {
    setPage(1)
    setReloadToken((value) => value + 1)
    void reloadDirectory()
  }, [reloadDirectory])

  const handleDelete = React.useCallback(
    async (row: DriverRow) => {
      const confirmed = await confirm({
        title: t('taxi_fleet.drivers.list.deleteConfirm', 'Delete this driver profile?'),
        variant: 'destructive',
      })
      if (!confirmed) return
      await deleteCrud('taxi_fleet/driver-profiles', row.id, {
        errorMessage: t('taxi_fleet.drivers.list.deleteError', 'Failed to delete driver profile.'),
      })
      flash(t('taxi_fleet.drivers.list.deleteSuccess', 'Driver profile deleted.'), 'success')
      handleRefresh()
    },
    [confirm, handleRefresh, t],
  )

  const columns = React.useMemo<ColumnDef<DriverRow>[]>(
    () => [
      {
        accessorKey: 'teamMemberId',
        header: t('taxi_fleet.drivers.member', 'Team member'),
        cell: ({ row }) => {
          const onShift = row.original.onShift === true
          return (
            <Link
              href={detailHref(row.original.id)}
              className="inline-flex items-center gap-2 font-medium hover:underline"
            >
              <span
                className={cn(
                  'inline-block size-2.5 shrink-0 rounded-full',
                  onShift ? 'bg-emerald-500' : 'bg-muted-foreground/35',
                )}
                title={
                  onShift
                    ? t('taxi_fleet.drivers.list.filters.onShiftYes', 'On shift')
                    : t('taxi_fleet.drivers.list.filters.onShiftNo', 'Off shift')
                }
                aria-label={
                  onShift
                    ? t('taxi_fleet.drivers.list.filters.onShiftYes', 'On shift')
                    : t('taxi_fleet.drivers.list.filters.onShiftNo', 'Off shift')
                }
              />
              <span>{resolveName(row.original.teamMemberId)}</span>
            </Link>
          )
        },
      },
      {
        id: 'assignedVehicle',
        header: t('taxi_fleet.drivers.list.assignedVehicle', 'Assigned vehicle'),
        cell: ({ row }) => {
          const ids = Array.isArray(row.original.defaultResourceIds)
            ? row.original.defaultResourceIds
            : row.original.defaultResourceId
              ? [row.original.defaultResourceId]
              : []
          if (!ids.length) return '—'
          const primary = resolveResourceLabel(ids[0]!)
          const extra = ids.length - 1
          if (extra <= 0) return primary
          return (
            <span className="whitespace-nowrap">
              {primary}{' '}
              <span className="text-muted-foreground">+{extra}</span>
            </span>
          )
        },
      },
      {
        accessorKey: 'payoutPercent',
        header: t('taxi_fleet.drivers.payoutPercent', 'Payout'),
        cell: ({ row }) => {
          if (row.original.payoutMode === 'tiered') {
            const count = Array.isArray(row.original.payoutTiersJson) ? row.original.payoutTiersJson.length : 0
            return t('taxi_fleet.drivers.payoutMode.tieredSummary', 'Tiered ({count})').replace(
              '{count}',
              String(count),
            )
          }
          return formatPercentDisplay(row.original.payoutPercent)
        },
      },
      {
        accessorKey: 'externalAppEnabled',
        header: t('taxi_fleet.drivers.mobileApp', 'Mobile app'),
        cell: ({ row }) =>
          row.original.externalAppEnabled ? (
            <Badge>{t('common.yes', 'Yes')}</Badge>
          ) : (
            <Badge variant="secondary">{t('common.no', 'No')}</Badge>
          ),
      },
    ],
    [resolveName, resolveResourceLabel, t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable<DriverRow>
          title={t('taxi_fleet.drivers.title', 'Driver profiles')}
          description={t('taxi_fleet.drivers.description', 'Payout settings and mobile app access per driver.')}
          refreshButton={{
            label: t('taxi_fleet.drivers.list.actions.refresh', 'Refresh'),
            onRefresh: handleRefresh,
          }}
          actions={
            canManageSettlements ? (
              <Button type="button" size="sm" className="inline-flex items-center gap-2" asChild>
                <Link href={`${TAXI_FLEET_BASE}/drivers/create`}>
                  <Plus className="size-4 shrink-0" aria-hidden />
                  {t('taxi_fleet.drivers.create', 'Add driver profile')}
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
                  label: t('taxi_fleet.drivers.list.actions.viewDetails', 'View details'),
                  onSelect: () => router.push(detailHref(row.id)),
                },
                {
                  id: 'open-tab',
                  label: t('taxi_fleet.drivers.list.actions.openInNewTab', 'Open in new tab'),
                  onSelect: () => window.open(detailHref(row.id), '_blank', 'noopener,noreferrer'),
                },
                ...(canManageSettlements
                  ? [
                      {
                        id: 'delete',
                        label: t('taxi_fleet.drivers.list.actions.delete', 'Delete'),
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
          emptyState={t('taxi_fleet.drivers.empty', 'No driver profiles configured.')}
          pagination={{ page, totalPages, total, pageSize: PAGE_SIZE, onPageChange: setPage }}
          perspective={{ tableId: 'taxi_fleet.drivers' }}
        />
      </PageBody>
      {ConfirmDialogElement}
    </Page>
  )
}
