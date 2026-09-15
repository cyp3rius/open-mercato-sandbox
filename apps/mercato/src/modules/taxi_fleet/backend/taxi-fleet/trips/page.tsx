"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, RefreshCw, Upload } from 'lucide-react'
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
import { formatDateTime } from '@open-mercato/shared/lib/time'
import { parseNumericValue } from '@open-mercato/shared/lib/numeric'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { TAXI_FLEET_BASE } from '../paths'
import { useFleetDriverDirectory } from '../../../components/useFleetDriverDirectory'
import { useTaxiFleetLabels, TAXI_FLEET_TRIP_TYPES, TAXI_FLEET_PLANNING_DEFAULT_TRIP_TYPES } from '../../../components/useTaxiFleetLabels'
import { useTaxiFleetPermissions } from '../../../components/useTaxiFleetPermissions'
import { useFleetBackendSession } from '../../../components/useFleetBackendSession'
import { useTaxiFleetSettings } from '../../../components/useTaxiFleetSettings'
import { useResourceLabels } from '../../../components/useResourceLabels'
import { TripCustomerPreview } from '../../../components/TripCustomerPreview'
import { TripListOcrIcon } from '../../../components/TripListOcrIcon'
import { useTripStatusDictionary } from '../../../components/useTripStatusDictionary'
import { DictionaryAppearancePreview } from '@open-mercato/core/modules/dictionaries/components/dictionaryAppearance'
import { PlatformTripIngestBadge } from '../../../components/PlatformTripIngestBadge'
import { PlatformSyncImportCsvDialog } from '../../../components/PlatformSyncImportCsvDialog'
import {
  formatPlatformSyncRunFlashMessage,
  resolvePlatformSyncFlashVariant,
} from '../../../components/platformSyncResultSummary'
import { remoteSearchFleetResources } from '../../../lib/fleetResourceSearch'
import {
  remoteSearchFleetCustomers,
  resolveFleetCustomerDisplayLabel,
} from '../../../lib/fleetCustomerEntitySearch'
import { TAXI_FLEET_TRIP_PLATFORMS } from '../../../lib/tripPlatforms'
import { TRIP_PAYMENT_TYPE_FILTER_OPTIONS } from '../../../lib/tripRequestForm'
import type { DriverTripReceiptWarning } from '../../../lib/driverTripReceiptStatus'

const PAGE_SIZE = 20

function createDefaultTripListFilters(): FilterValues {
  return {
    tripTypes: [...TAXI_FLEET_PLANNING_DEFAULT_TRIP_TYPES],
  }
}

function formatTripRevenue(
  amount: string | number | null | undefined,
  currencyCode?: string | null,
): string {
  const parsed = parseNumericValue(amount)
  if (parsed === null) return '—'
  const value = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parsed)
  const currency = currencyCode?.trim() || 'PLN'
  return `${value} ${currency}`
}

type TripRow = {
  id: string
  tripType: string
  status: string
  platform?: string | null
  externalTripId?: string | null
  teamMemberId?: string | null
  resourceId?: string | null
  customerPersonId?: string | null
  customerCompanyId?: string | null
  paymentType?: string | null
  revenueAmount?: string | null
  currencyCode?: string | null
  startedAt?: string | null
  metadata?: Record<string, unknown> | null
  receiptAttachmentId?: string | null
  ocrStatus?: string | null
  warnings?: DriverTripReceiptWarning[]
}

type ListResponse = {
  items: TripRow[]
  totalPages: number
  total?: number
  revenueSummary?: { revenueAmount: number; currencyCode: string } | null
}

export default function TaxiFleetTripsPage() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const scopeVersion = useOrganizationScopeVersion()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const { profiles, resolveName } = useFleetDriverDirectory()
  const { resolveTripTypeLabel } = useTaxiFleetLabels()
  const { statusOptions, findDefinition } = useTripStatusDictionary()
  const { canManageTrips, canManagePlatformSync } = useTaxiFleetPermissions()
  const { isDriverOnly } = useFleetBackendSession()
  const { resourceTypeId } = useTaxiFleetSettings()
  const [importOpen, setImportOpen] = React.useState(false)
  const [syncBusy, setSyncBusy] = React.useState(false)
  const [rows, setRows] = React.useState<TripRow[]>([])
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [revenueSummary, setRevenueSummary] = React.useState<{
    revenueAmount: number
    currencyCode: string
  } | null>(null)
  const unscheduledOnly = searchParams.get('unscheduled') === '1' || searchParams.get('unscheduled') === 'true'
  const [vehicleFilterOptions, setVehicleFilterOptions] = React.useState<Array<{ value: string; label: string }>>([])
  const [customerFilterOptions, setCustomerFilterOptions] = React.useState<Array<{ value: string; label: string }>>([])

  const [filterValues, setFilterValues] = React.useState<FilterValues>(() => createDefaultTripListFilters())

  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)

  const selectedTripTypes = React.useMemo(() => {
    const raw = filterValues.tripTypes
    if (!Array.isArray(raw)) return [...TAXI_FLEET_PLANNING_DEFAULT_TRIP_TYPES]
    return raw
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter((value): value is string => value.length > 0)
  }, [filterValues.tripTypes])

  const selectedResourceId =
    typeof filterValues.resourceId === 'string' && filterValues.resourceId.length > 0
      ? filterValues.resourceId
      : null
  const selectedCustomerEntityId =
    typeof filterValues.customerEntityId === 'string' && filterValues.customerEntityId.length > 0
      ? filterValues.customerEntityId
      : null

  const resourceIds = React.useMemo(() => {
    const ids = new Set<string>()
    rows.forEach((row) => {
      if (row.resourceId) ids.add(row.resourceId)
    })
    if (selectedResourceId) ids.add(selectedResourceId)
    return [...ids]
  }, [rows, selectedResourceId])
  const { resolveLabel: resolveResourceLabel } = useResourceLabels(resourceIds)

  const driverFilterOptions = React.useMemo(
    () =>
      profiles.map((profile) => ({
        value: profile.teamMemberId,
        label: resolveName(profile.teamMemberId),
      })),
    [profiles, resolveName],
  )

  const customerKindLabels = React.useMemo(
    () => ({
      person: t('taxi_fleet.trips.customerKind.person', 'Person'),
      company: t('taxi_fleet.trips.customerKind.company', 'Company'),
    }),
    [t],
  )

  React.useEffect(() => {
    let cancelled = false
    async function loadVehicleOptions() {
      const rows = await remoteSearchFleetResources('', resourceTypeId)
      if (cancelled) return
      setVehicleFilterOptions(rows.map((row) => ({ value: row.value, label: row.label })))
    }
    void loadVehicleOptions()
    return () => {
      cancelled = true
    }
  }, [resourceTypeId, scopeVersion])

  React.useEffect(() => {
    if (!selectedCustomerEntityId) return
    let cancelled = false
    async function ensureCustomerOption() {
      const label = await resolveFleetCustomerDisplayLabel(selectedCustomerEntityId!)
      if (cancelled || !label) return
      setCustomerFilterOptions((current) => {
        if (current.some((option) => option.value === selectedCustomerEntityId)) return current
        return [...current, { value: selectedCustomerEntityId!, label }]
      })
    }
    void ensureCustomerOption()
    return () => {
      cancelled = true
    }
  }, [selectedCustomerEntityId])

  const filters = React.useMemo<FilterDef[]>(
    () => [
      {
        id: 'startedAt',
        label: t('taxi_fleet.trips.date', 'Date'),
        type: 'dateRange',
        dateTime: true,
      },
      {
        id: 'status',
        label: t('taxi_fleet.trips.status', 'Status'),
        type: 'select',
        options: statusOptions,
      },
      {
        id: 'tripTypes',
        label: t('taxi_fleet.trips.type', 'Type'),
        type: 'select',
        multiple: true,
        options: TAXI_FLEET_TRIP_TYPES.map((type) => ({
          value: type,
          label: t(`taxi_fleet.trips.types.${type}`, type),
        })),
      },
      {
        id: 'platform',
        label: t('taxi_fleet.trips.platform', 'Platform'),
        type: 'select',
        options: TAXI_FLEET_TRIP_PLATFORMS.map((platform) => ({
          value: platform,
          label: t(`taxi_fleet.trips.platforms.${platform}`, platform),
        })),
      },
      {
        id: 'customerEntityId',
        label: t('taxi_fleet.trips.customer', 'Customer'),
        type: 'combobox',
        options: customerFilterOptions,
        formatValue: (id) =>
          customerFilterOptions.find((option) => option.value === id)?.label ?? id,
        loadOptions: async (query) => {
          const rows = await remoteSearchFleetCustomers(query ?? '', customerKindLabels)
          const mapped = rows.map((row) => ({ value: row.value, label: row.label }))
          setCustomerFilterOptions((current) => {
            const byValue = new Map(current.map((option) => [option.value, option]))
            for (const option of mapped) byValue.set(option.value, option)
            return [...byValue.values()]
          })
          return mapped
        },
        placeholder: t('taxi_fleet.trips.customerSearch', 'Search customer…'),
      },
      ...(isDriverOnly
        ? []
        : [
            {
              id: 'teamMemberId',
              label: t('taxi_fleet.trips.driver', 'Driver'),
              type: 'combobox' as const,
              options: driverFilterOptions,
              formatValue: (id: string) => resolveName(id),
              loadOptions: async (query?: string) => {
                const normalized = query?.trim().toLowerCase() ?? ''
                if (!normalized) return driverFilterOptions
                return driverFilterOptions.filter((option) =>
                  option.label.toLowerCase().includes(normalized),
                )
              },
              placeholder: t('taxi_fleet.assignments.filterDriver', 'Select driver…'),
            },
          ]),
      {
        id: 'resourceId',
        label: t('taxi_fleet.assignments.vehicle', 'Vehicle'),
        type: 'combobox',
        options: vehicleFilterOptions,
        formatValue: (id) => resolveResourceLabel(id),
        loadOptions: async (query) => {
          const rows = await remoteSearchFleetResources(query ?? '', resourceTypeId)
          return rows.map((row) => ({ value: row.value, label: row.label }))
        },
        placeholder: t('taxi_fleet.assignments.filterVehicle', 'Select vehicle…'),
      },
      {
        id: 'paymentType',
        label: t('taxi_fleet.trips.form.paymentType', 'Payment method'),
        type: 'select',
        options: TRIP_PAYMENT_TYPE_FILTER_OPTIONS.map((value) => ({
          value,
          label: t(`taxi_fleet.trips.form.paymentTypes.${value}`, value),
        })),
      },
    ],
    [
      customerFilterOptions,
      customerKindLabels,
      driverFilterOptions,
      isDriverOnly,
      resolveName,
      resolveResourceLabel,
      resourceTypeId,
      statusOptions,
      t,
      vehicleFilterOptions,
    ],
  )

  const queryParams = React.useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      sortField: 'startedAt',
      sortDir: 'desc',
    })
    if (unscheduledOnly) params.set('unscheduled', 'true')
    const startedAtRange =
      filterValues.startedAt && typeof filterValues.startedAt === 'object'
        ? (filterValues.startedAt as { from?: string; to?: string })
        : null
    const dateFrom = typeof startedAtRange?.from === 'string' ? startedAtRange.from.trim() : ''
    const dateTo = typeof startedAtRange?.to === 'string' ? startedAtRange.to.trim() : ''
    if (dateFrom) {
      const fromDate = new Date(dateFrom)
      params.set('dateFrom', Number.isNaN(fromDate.getTime()) ? dateFrom : fromDate.toISOString())
    }
    if (dateTo) {
      const toDate = new Date(dateTo)
      params.set('dateTo', Number.isNaN(toDate.getTime()) ? dateTo : toDate.toISOString())
    }
    const status = filterValues.status
    if (typeof status === 'string' && status.trim()) params.set('status', status.trim())
    if (selectedTripTypes.length > 0) {
      params.set('tripType', selectedTripTypes.join(','))
    }
    const platform = filterValues.platform
    if (typeof platform === 'string' && platform.trim()) params.set('platform', platform.trim())
    const customerEntityId = filterValues.customerEntityId
    if (typeof customerEntityId === 'string' && customerEntityId.trim()) {
      params.set('customerEntityId', customerEntityId.trim())
    }
    const teamMemberId = filterValues.teamMemberId
    if (typeof teamMemberId === 'string' && teamMemberId.trim()) {
      params.set('teamMemberId', teamMemberId.trim())
    }
    const resourceId = filterValues.resourceId
    if (typeof resourceId === 'string' && resourceId.trim()) params.set('resourceId', resourceId.trim())
    const paymentType = filterValues.paymentType
    if (typeof paymentType === 'string' && paymentType.trim()) {
      params.set('paymentType', paymentType.trim())
    }
    return params.toString()
  }, [
    filterValues.customerEntityId,
    filterValues.paymentType,
    filterValues.platform,
    filterValues.resourceId,
    filterValues.startedAt,
    filterValues.status,
    filterValues.teamMemberId,
    page,
    selectedTripTypes,
    unscheduledOnly,
  ])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (selectedTripTypes.length === 0) {
        setRows([])
        setTotalPages(1)
        setTotal(0)
        setRevenueSummary(null)
        setIsLoading(false)
        return
      }
      setIsLoading(true)
      const call = await apiCall<ListResponse>(`/api/taxi_fleet/trips?${queryParams}`)
      if (cancelled) return
      setRows(Array.isArray(call.result?.items) ? call.result.items : [])
      setTotalPages(call.result?.totalPages ?? 1)
      setTotal(call.result?.total ?? call.result?.items?.length ?? 0)
      setRevenueSummary(call.result?.revenueSummary ?? null)
      setIsLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [queryParams, reloadToken, scopeVersion, selectedTripTypes.length])

  const revenueSummaryRow = React.useMemo(() => {
    if (!revenueSummary) return null
    const amount = formatTripRevenue(
      revenueSummary.revenueAmount,
      revenueSummary.currencyCode,
    )
    return {
      cells: {
        startedAt: (
          <span className="text-muted-foreground">
            {t('taxi_fleet.trips.list.revenueSummaryLabel', 'Total revenue')}
          </span>
        ),
        revenueAmount: (
          <span className="tabular-nums font-semibold text-foreground whitespace-nowrap">
            {amount}
          </span>
        ),
      },
    }
  }, [revenueSummary, t])

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

  const handleSyncNow = React.useCallback(async () => {
    if (syncBusy) return
    setSyncBusy(true)
    const call = await apiCall<{
      upsertedCount?: number
      skippedCount?: number
      unmappedDriverSkippedCount?: number
      errorCount?: number
      createdCount?: number
    }>(
      '/api/taxi_fleet/platform-sync/run',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      },
    )
    setSyncBusy(false)
    if (!call.ok) {
      const message =
        (call.result as { error?: string } | null)?.error ??
        t('taxi_fleet.platformSync.run.error', 'Sync failed.')
      flash(message, 'error')
      return
    }
    const counts = {
      upsertedCount: call.result?.upsertedCount ?? call.result?.createdCount ?? 0,
      skippedCount: call.result?.skippedCount ?? 0,
      unmappedDriverSkippedCount: call.result?.unmappedDriverSkippedCount ?? 0,
      errorCount: call.result?.errorCount ?? 0,
    }
    flash(formatPlatformSyncRunFlashMessage(counts, t), resolvePlatformSyncFlashVariant(counts))
    setReloadToken((value) => value + 1)
  }, [syncBusy, t])

  const columns = React.useMemo<ColumnDef<TripRow>[]>(
    () => [
      {
        accessorKey: 'startedAt',
        header: t('taxi_fleet.trips.date', 'Date'),
        enableSorting: true,
        meta: { truncate: false, maxWidth: '12rem' },
        cell: ({ row }) => (
          <Link
            href={detailHref(row.original.id)}
            className="whitespace-nowrap font-medium tabular-nums hover:underline"
          >
            {formatDateTime(row.original.startedAt) ?? '—'}
          </Link>
        ),
      },
      {
        accessorKey: 'tripType',
        header: t('taxi_fleet.trips.type', 'Type'),
        cell: ({ row }) => resolveTripTypeLabel(row.original.tripType),
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
        id: 'platform',
        header: t('taxi_fleet.trips.platform', 'Platform'),
        cell: ({ row }) => (
          <PlatformTripIngestBadge
            variant="compact"
            metadata={row.original.metadata ?? null}
            platform={row.original.platform ?? null}
          />
        ),
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
        id: 'vehicle',
        header: t('taxi_fleet.assignments.vehicle', 'Vehicle'),
        cell: ({ row }) =>
          row.original.resourceId ? resolveResourceLabel(row.original.resourceId) : '—',
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
      {
        id: 'paymentType',
        header: t('taxi_fleet.trips.form.paymentType', 'Payment method'),
        cell: ({ row }) => {
          const paymentType = row.original.paymentType
          if (!paymentType) return '—'
          return t(`taxi_fleet.trips.form.paymentTypes.${paymentType}`, paymentType)
        },
      },
      {
        accessorKey: 'revenueAmount',
        header: t('taxi_fleet.trips.revenue', 'Revenue'),
        cell: ({ row }) => (
          <span className="tabular-nums whitespace-nowrap">
            {formatTripRevenue(row.original.revenueAmount, row.original.currencyCode)}
          </span>
        ),
      },
      {
        id: 'ocr',
        header: t('taxi_fleet.trips.list.ocr', 'OCR'),
        cell: ({ row }) => (
          <TripListOcrIcon
            item={{
              receiptAttachmentId: row.original.receiptAttachmentId,
              ocrStatus: row.original.ocrStatus,
              warnings: row.original.warnings,
              metadata: row.original.metadata,
            }}
          />
        ),
      },
    ],
    [findDefinition, resolveName, resolveResourceLabel, resolveTripTypeLabel, t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable<TripRow>
          title={t('taxi_fleet.trips.list.title', 'Trips')}
          sortable
          sorting={[{ id: 'startedAt', desc: true }]}
          summaryRow={revenueSummaryRow}
          refreshButton={{
            label: t('taxi_fleet.trips.list.actions.refresh', 'Refresh'),
            onRefresh: () => {
              setPage(1)
              setReloadToken((value) => value + 1)
            },
          }}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {canManagePlatformSync ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="inline-flex items-center gap-2"
                    disabled={syncBusy}
                    onClick={() => void handleSyncNow()}
                  >
                    <RefreshCw className="size-4 shrink-0" aria-hidden />
                    {syncBusy
                      ? t('taxi_fleet.platformSync.run.running', 'Syncing…')
                      : t('taxi_fleet.platformSync.run.action', 'Sync now')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="inline-flex items-center gap-2"
                    onClick={() => setImportOpen(true)}
                  >
                    <Upload className="size-4 shrink-0" aria-hidden />
                    {t('taxi_fleet.platformSync.import.action', 'Import CSV')}
                  </Button>
                </>
              ) : null}
              {canManageTrips ? (
                <Button asChild type="button" size="sm" className="inline-flex items-center gap-2">
                  <Link href={`${TAXI_FLEET_BASE}/trips/create`}>
                    <Plus className="size-4 shrink-0" aria-hidden />
                    {t('taxi_fleet.trips.actions.new', 'New trip')}
                  </Link>
                </Button>
              ) : null}
            </div>
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
            setFilterValues(createDefaultTripListFilters())
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
      <PlatformSyncImportCsvDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => setReloadToken((value) => value + 1)}
      />
      {ConfirmDialogElement}
    </Page>
  )
}
