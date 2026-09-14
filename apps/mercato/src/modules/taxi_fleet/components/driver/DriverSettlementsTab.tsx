'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import type { FilterDef, FilterValues } from '@open-mercato/ui/backend/FilterBar'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { formatDateTime } from '@open-mercato/shared/lib/time'
import { formatMoneyDisplay, formatSignedMoneyDisplay } from '@open-mercato/shared/lib/numeric'
import { TAXI_FLEET_BASE } from '../../backend/taxi-fleet/paths'
import { useTaxiFleetLabels } from '../useTaxiFleetLabels'
import { SettlementGenerateDialog } from '../SettlementGenerateDialog'
import { MonthlySettlementGenerateDialog } from '../MonthlySettlementGenerateDialog'
import { SettlementStatusBadge } from '../SettlementStatusBadge'
import { formatWeekRange } from '../../lib/weekUtils'
import { formatSettlementMoney } from '../../lib/settlementPayoutDisplay'
import {
  canDeleteMonthlySettlement,
  MONTHLY_SETTLEMENT_OPERATOR_STATUSES,
  WEEKLY_SETTLEMENT_STATUSES,
} from '../../lib/settlementStatusTransitions'
import {
  DriverFinancialEntryDialog,
  TAXI_FLEET_COST_TYPES,
  TAXI_FLEET_INCOME_DOCUMENT_TYPES,
  type FinancialEntryRow,
} from '../DriverFinancialEntryDialog'
import { TripCustomerPreview } from '../TripCustomerPreview'

const PAGE_SIZE = 20

type SettlementRow = {
  id: string
  weekStart: string
  status: string
  payoutAmount: string
  netAmount: string
}

type MonthlySettlementRow = {
  id: string
  monthStart: string
  status: string
  revenueNet?: string
  payoutAmount?: string
  weeklyCount?: number
}

type ListResponse<T> = { items: T[]; totalPages: number; total?: number }

type DriverSettlementsTabProps = {
  teamMemberId: string
  canManageSettlements: boolean
}

function toDateOnlyParam(value: string): string {
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return trimmed
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatMonthLabel(monthStart: string): string {
  return monthStart.slice(0, 7)
}

export function DriverSettlementsTab({
  teamMemberId,
  canManageSettlements,
}: DriverSettlementsTabProps) {
  const t = useT()
  const router = useRouter()
  const scopeVersion = useOrganizationScopeVersion()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const { resolveSettlementStatusLabel, resolveIncomeDocumentTypeLabel, resolveCostTypeLabel } =
    useTaxiFleetLabels()

  const [entries, setEntries] = React.useState<FinancialEntryRow[]>([])
  const [entryPage, setEntryPage] = React.useState(1)
  const [entryTotalPages, setEntryTotalPages] = React.useState(1)
  const [entryTotal, setEntryTotal] = React.useState(0)
  const [entryFilterValues, setEntryFilterValues] = React.useState<FilterValues>({})
  const [entriesLoading, setEntriesLoading] = React.useState(true)
  const [entriesReloadToken, setEntriesReloadToken] = React.useState(0)

  const [settlements, setSettlements] = React.useState<SettlementRow[]>([])
  const [weeklyPage, setWeeklyPage] = React.useState(1)
  const [weeklyTotalPages, setWeeklyTotalPages] = React.useState(1)
  const [weeklyTotal, setWeeklyTotal] = React.useState(0)
  const [weeklyFilterValues, setWeeklyFilterValues] = React.useState<FilterValues>({})
  const [weeklyLoading, setWeeklyLoading] = React.useState(true)
  const [weeklyReloadToken, setWeeklyReloadToken] = React.useState(0)

  const [monthlyRows, setMonthlyRows] = React.useState<MonthlySettlementRow[]>([])
  const [monthlyPage, setMonthlyPage] = React.useState(1)
  const [monthlyTotalPages, setMonthlyTotalPages] = React.useState(1)
  const [monthlyTotal, setMonthlyTotal] = React.useState(0)
  const [monthlyFilterValues, setMonthlyFilterValues] = React.useState<FilterValues>({})
  const [monthlyLoading, setMonthlyLoading] = React.useState(true)
  const [monthlyReloadToken, setMonthlyReloadToken] = React.useState(0)

  const [generateOpen, setGenerateOpen] = React.useState(false)
  const [monthlyGenerateOpen, setMonthlyGenerateOpen] = React.useState(false)
  const [financialDialogOpen, setFinancialDialogOpen] = React.useState(false)
  const [financialDialogMode, setFinancialDialogMode] = React.useState<'income' | 'expense'>('income')
  const [financialDialogEntry, setFinancialDialogEntry] = React.useState<FinancialEntryRow | null>(null)

  const entryFilters = React.useMemo<FilterDef[]>(
    () => [
      {
        id: 'occurredAt',
        label: t('taxi_fleet.settlements.ledger.date', 'Date'),
        type: 'dateRange',
      },
      {
        id: 'kind',
        label: t('taxi_fleet.settlements.ledger.kind', 'Type'),
        type: 'select',
        options: [
          { value: 'income', label: t('taxi_fleet.settlements.ledger.income', 'Income') },
          { value: 'expense', label: t('taxi_fleet.settlements.ledger.expense', 'Expense') },
        ],
      },
      {
        id: 'documentType',
        label: t('taxi_fleet.financial.documentType', 'Document type'),
        type: 'select',
        options: [
          ...TAXI_FLEET_INCOME_DOCUMENT_TYPES.map((type) => ({
            value: type,
            label: resolveIncomeDocumentTypeLabel(type),
          })),
          ...TAXI_FLEET_COST_TYPES.map((type) => ({
            value: type,
            label: resolveCostTypeLabel(type),
          })),
        ],
      },
      {
        id: 'documentNumber',
        label: t('taxi_fleet.financial.documentNumber', 'Document number'),
        type: 'text',
      },
    ],
    [resolveCostTypeLabel, resolveIncomeDocumentTypeLabel, t],
  )

  const weeklyFilters = React.useMemo<FilterDef[]>(
    () => [
      {
        id: 'status',
        label: t('taxi_fleet.settlements.status', 'Status'),
        type: 'select',
        options: WEEKLY_SETTLEMENT_STATUSES.map((status) => ({
          value: status,
          label: resolveSettlementStatusLabel(status),
        })),
      },
    ],
    [resolveSettlementStatusLabel, t],
  )

  const monthlyFilters = React.useMemo<FilterDef[]>(
    () => [
      {
        id: 'status',
        label: t('taxi_fleet.settlements.status', 'Status'),
        type: 'select',
        options: MONTHLY_SETTLEMENT_OPERATOR_STATUSES.map((status) => ({
          value: status,
          label: t(`taxi_fleet.settlements.statuses.${status}`, status),
        })),
      },
    ],
    [t],
  )

  const entryQueryParams = React.useMemo(() => {
    const params = new URLSearchParams({
      page: String(entryPage),
      pageSize: String(PAGE_SIZE),
      teamMemberId,
      sortField: 'occurredAt',
      sortDir: 'desc',
    })
    const occurredAtRange =
      entryFilterValues.occurredAt && typeof entryFilterValues.occurredAt === 'object'
        ? (entryFilterValues.occurredAt as { from?: string; to?: string })
        : null
    const dateFrom =
      typeof occurredAtRange?.from === 'string' ? toDateOnlyParam(occurredAtRange.from) : ''
    const dateTo = typeof occurredAtRange?.to === 'string' ? toDateOnlyParam(occurredAtRange.to) : ''
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    const kind = entryFilterValues.kind
    if (typeof kind === 'string' && kind.trim()) params.set('kind', kind.trim())
    const documentType =
      typeof entryFilterValues.documentType === 'string' ? entryFilterValues.documentType.trim() : ''
    if (documentType) {
      if ((TAXI_FLEET_INCOME_DOCUMENT_TYPES as readonly string[]).includes(documentType)) {
        params.set('incomeDocumentType', documentType)
      } else if ((TAXI_FLEET_COST_TYPES as readonly string[]).includes(documentType)) {
        params.set('costType', documentType)
      }
    }
    const documentNumber = entryFilterValues.documentNumber
    if (typeof documentNumber === 'string' && documentNumber.trim()) {
      params.set('documentNumber', documentNumber.trim())
    }
    return params.toString()
  }, [entryFilterValues, entryPage, teamMemberId])

  const weeklyQueryParams = React.useMemo(() => {
    const params = new URLSearchParams({
      page: String(weeklyPage),
      pageSize: String(PAGE_SIZE),
      teamMemberId,
      sortField: 'weekStart',
      sortDir: 'desc',
    })
    const status = weeklyFilterValues.status
    if (typeof status === 'string' && status.trim()) params.set('status', status.trim())
    return params.toString()
  }, [teamMemberId, weeklyFilterValues.status, weeklyPage])

  const monthlyQueryParams = React.useMemo(() => {
    const params = new URLSearchParams({
      page: String(monthlyPage),
      pageSize: String(PAGE_SIZE),
      teamMemberId,
      sortField: 'monthStart',
      sortDir: 'desc',
    })
    const status = monthlyFilterValues.status
    if (typeof status === 'string' && status.trim()) params.set('status', status.trim())
    return params.toString()
  }, [monthlyFilterValues.status, monthlyPage, teamMemberId])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setEntriesLoading(true)
      const call = await apiCall<ListResponse<FinancialEntryRow>>(
        `/api/taxi_fleet/financial-entries?${entryQueryParams}`,
      )
      if (cancelled) return
      setEntries(Array.isArray(call.result?.items) ? call.result.items : [])
      setEntryTotalPages(call.result?.totalPages ?? 1)
      setEntryTotal(call.result?.total ?? call.result?.items?.length ?? 0)
      setEntriesLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [entryQueryParams, entriesReloadToken, scopeVersion])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setWeeklyLoading(true)
      const call = await apiCall<ListResponse<SettlementRow>>(
        `/api/taxi_fleet/settlements?${weeklyQueryParams}`,
      )
      if (cancelled) return
      setSettlements(Array.isArray(call.result?.items) ? call.result.items : [])
      setWeeklyTotalPages(call.result?.totalPages ?? 1)
      setWeeklyTotal(call.result?.total ?? call.result?.items?.length ?? 0)
      setWeeklyLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [scopeVersion, weeklyQueryParams, weeklyReloadToken])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setMonthlyLoading(true)
      const call = await apiCall<ListResponse<MonthlySettlementRow>>(
        `/api/taxi_fleet/monthly-settlements?${monthlyQueryParams}`,
      )
      if (cancelled) return
      setMonthlyRows(Array.isArray(call.result?.items) ? call.result.items : [])
      setMonthlyTotalPages(call.result?.totalPages ?? 1)
      setMonthlyTotal(call.result?.total ?? call.result?.items?.length ?? 0)
      setMonthlyLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [monthlyQueryParams, monthlyReloadToken, scopeVersion])

  const openCreate = React.useCallback((mode: 'income' | 'expense') => {
    setFinancialDialogMode(mode)
    setFinancialDialogEntry(null)
    setFinancialDialogOpen(true)
  }, [])

  const openEdit = React.useCallback((entry: FinancialEntryRow) => {
    setFinancialDialogMode(entry.kind)
    setFinancialDialogEntry(entry)
    setFinancialDialogOpen(true)
  }, [])

  const handleDeleteEntry = React.useCallback(
    async (entry: FinancialEntryRow) => {
      const ok = await confirm({
        title: t('taxi_fleet.financial.deleteConfirm', 'Delete this entry?'),
        variant: 'destructive',
      })
      if (!ok) return
      await deleteCrud('taxi_fleet/financial-entries', entry.id, {
        errorMessage: t('taxi_fleet.financial.deleteError', 'Could not delete entry.'),
      })
      flash(t('taxi_fleet.financial.deleted', 'Entry deleted.'), 'success')
      setEntriesReloadToken((value) => value + 1)
    },
    [confirm, t],
  )

  const handleDeleteMonthly = React.useCallback(
    async (settlement: MonthlySettlementRow) => {
      const ok = await confirm({
        title: t(
          'taxi_fleet.monthlySettlements.list.deleteConfirm',
          'Delete this draft monthly settlement?',
        ),
        variant: 'destructive',
      })
      if (!ok) return
      await deleteCrud('taxi_fleet/monthly-settlements', settlement.id, {
        errorMessage: t(
          'taxi_fleet.monthlySettlements.list.deleteError',
          'Could not delete monthly settlement.',
        ),
      })
      flash(
        t('taxi_fleet.monthlySettlements.list.deleteSuccess', 'Monthly settlement deleted.'),
        'success',
      )
      setMonthlyReloadToken((value) => value + 1)
    },
    [confirm, t],
  )

  const entryColumns = React.useMemo<ColumnDef<FinancialEntryRow>[]>(
    () => [
      {
        accessorKey: 'occurredAt',
        header: t('taxi_fleet.settlements.ledger.date', 'Date'),
        cell: ({ row }) =>
          formatDateTime(row.original.occurredAt ?? '') ?? row.original.occurredAt ?? '—',
      },
      {
        id: 'kind',
        header: t('taxi_fleet.settlements.ledger.kind', 'Type'),
        cell: ({ row }) => (
          <Badge variant={row.original.kind === 'income' ? 'default' : 'outline'}>
            {row.original.kind === 'income'
              ? t('taxi_fleet.settlements.ledger.income', 'Income')
              : t('taxi_fleet.settlements.ledger.expense', 'Expense')}
          </Badge>
        ),
      },
      {
        id: 'document',
        header: t('taxi_fleet.financial.documentType', 'Document type'),
        cell: ({ row }) => {
          if (row.original.kind === 'income' && row.original.incomeDocumentType) {
            return resolveIncomeDocumentTypeLabel(row.original.incomeDocumentType)
          }
          if (row.original.kind === 'expense' && row.original.costType) {
            return resolveCostTypeLabel(row.original.costType)
          }
          return '—'
        },
      },
      {
        id: 'customer',
        header: t('taxi_fleet.financial.customerCounterparty', 'Customer / Counterparty'),
        cell: ({ row }) => (
          <TripCustomerPreview
            customerPersonId={row.original.customerPersonId}
            customerCompanyId={row.original.customerCompanyId}
          />
        ),
      },
      {
        accessorKey: 'documentNumber',
        header: t('taxi_fleet.financial.documentNumber', 'Document number'),
        cell: ({ row }) => row.original.documentNumber ?? '—',
      },
      {
        id: 'amount',
        header: t('taxi_fleet.settlements.ledger.amount', 'Amount'),
        cell: ({ row }) =>
          formatSignedMoneyDisplay(row.original.amount, {
            currency: row.original.currencyCode,
            sign: row.original.kind,
          }),
      },
      {
        id: 'trip',
        header: t('taxi_fleet.settlements.ledger.trip', 'Trip'),
        cell: ({ row }) =>
          row.original.tripId ? (
            <Link
              href={`${TAXI_FLEET_BASE}/trips/${encodeURIComponent(row.original.tripId)}`}
              className="text-sm text-primary hover:underline"
            >
              {t('taxi_fleet.settlements.ledger.viewTrip', 'View trip')}
            </Link>
          ) : (
            '—'
          ),
      },
    ],
    [resolveCostTypeLabel, resolveIncomeDocumentTypeLabel, t],
  )

  const settlementColumns = React.useMemo<ColumnDef<SettlementRow>[]>(
    () => [
      {
        accessorKey: 'weekStart',
        header: t('taxi_fleet.settlements.week', 'Week'),
        cell: ({ row }) => formatWeekRange(row.original.weekStart),
      },
      {
        accessorKey: 'status',
        header: t('taxi_fleet.settlements.status', 'Status'),
        cell: ({ row }) => <SettlementStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'netAmount',
        header: t('taxi_fleet.settlements.netAmount', 'Net amount'),
        cell: ({ row }) => formatMoneyDisplay(row.original.netAmount),
      },
      {
        accessorKey: 'payoutAmount',
        header: t('taxi_fleet.settlements.payout', 'Payout'),
        cell: ({ row }) => formatMoneyDisplay(row.original.payoutAmount),
      },
    ],
    [t],
  )

  const monthlyColumns = React.useMemo<ColumnDef<MonthlySettlementRow>[]>(
    () => [
      {
        accessorKey: 'monthStart',
        header: t('taxi_fleet.monthlySettlements.month', 'Month'),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">{formatMonthLabel(row.original.monthStart)}</span>
        ),
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
    [t],
  )

  const weeklyDetailHref = (id: string) =>
    `${TAXI_FLEET_BASE}/settlements/${encodeURIComponent(id)}`
  const monthlyDetailHref = (id: string) =>
    `${TAXI_FLEET_BASE}/monthly-settlements/${encodeURIComponent(id)}`

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-card px-4 py-3">
        <DataTable<FinancialEntryRow>
          embedded
          title={t('taxi_fleet.financial.title', 'Receipts, invoices & costs')}
          description={t(
            'taxi_fleet.financial.description',
            'Register customer receipts/invoices and driver costs with document numbers.',
          )}
          refreshButton={{
            label: t('common.refresh', 'Refresh'),
            onRefresh: () => {
              setEntryPage(1)
              setEntriesReloadToken((value) => value + 1)
            },
          }}
          filters={entryFilters}
          filterValues={entryFilterValues}
          onFiltersApply={(values) => {
            setEntryFilterValues(values)
            setEntryPage(1)
          }}
          onFiltersClear={() => {
            setEntryFilterValues({})
            setEntryPage(1)
          }}
          data={entries}
          columns={entryColumns}
          isLoading={entriesLoading}
          emptyState={t(
            'taxi_fleet.financial.empty',
            'No receipts, invoices, or costs registered yet.',
          )}
          pagination={{
            page: entryPage,
            totalPages: entryTotalPages,
            total: entryTotal,
            pageSize: PAGE_SIZE,
            onPageChange: setEntryPage,
          }}
          perspective={{ tableId: 'taxi-fleet-driver-financial-entries' }}
          actions={
            canManageSettlements ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="inline-flex items-center gap-2"
                  onClick={() => openCreate('income')}
                >
                  <Plus className="size-4 shrink-0" aria-hidden />
                  {t('taxi_fleet.financial.actions.addIncome', 'Register receipt/invoice')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="inline-flex items-center gap-2"
                  onClick={() => openCreate('expense')}
                >
                  <Plus className="size-4 shrink-0" aria-hidden />
                  {t('taxi_fleet.financial.actions.addExpense', 'Register cost')}
                </Button>
              </div>
            ) : undefined
          }
          rowActions={
            canManageSettlements
              ? (row) => (
                  <RowActions
                    items={[
                      {
                        id: 'edit',
                        label: t('common.edit', 'Edit'),
                        onSelect: () => openEdit(row),
                      },
                      {
                        id: 'delete',
                        label: t('common.delete', 'Delete'),
                        destructive: true,
                        onSelect: () => void handleDeleteEntry(row),
                      },
                    ]}
                  />
                )
              : undefined
          }
        />
      </section>

      <section className="rounded-lg border bg-card px-4 py-3">
        <DataTable<SettlementRow>
          embedded
          title={t('taxi_fleet.settlements.weeklyTitle', 'Weekly settlements')}
          refreshButton={{
            label: t('common.refresh', 'Refresh'),
            onRefresh: () => {
              setWeeklyPage(1)
              setWeeklyReloadToken((value) => value + 1)
            },
          }}
          filters={weeklyFilters}
          filterValues={weeklyFilterValues}
          onFiltersApply={(values) => {
            setWeeklyFilterValues(values)
            setWeeklyPage(1)
          }}
          onFiltersClear={() => {
            setWeeklyFilterValues({})
            setWeeklyPage(1)
          }}
          data={settlements}
          columns={settlementColumns}
          isLoading={weeklyLoading}
          emptyState={t('taxi_fleet.settlements.empty', 'No settlements yet.')}
          pagination={{
            page: weeklyPage,
            totalPages: weeklyTotalPages,
            total: weeklyTotal,
            pageSize: PAGE_SIZE,
            onPageChange: setWeeklyPage,
          }}
          perspective={{ tableId: 'taxi-fleet-driver-weekly-settlements' }}
          onRowClick={(row) => router.push(weeklyDetailHref(row.id))}
          actions={
            canManageSettlements ? (
              <Button
                type="button"
                size="sm"
                className="inline-flex items-center gap-2"
                onClick={() => setGenerateOpen(true)}
              >
                <Plus className="size-4 shrink-0" aria-hidden />
                {t('taxi_fleet.drivers.tabs.settlements.addSettlement', 'Generate settlement')}
              </Button>
            ) : undefined
          }
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  label: t('taxi_fleet.settlements.list.actions.viewDetails', 'View details'),
                  onSelect: () => router.push(weeklyDetailHref(row.id)),
                },
              ]}
            />
          )}
        />
      </section>

      <section className="rounded-lg border bg-card px-4 py-3">
        <DataTable<MonthlySettlementRow>
          embedded
          title={t('taxi_fleet.monthlySettlements.driverTab.title', 'Monthly settlements')}
          description={t(
            'taxi_fleet.monthlySettlements.driverTab.description',
            'Calendar-month payout settlements for this driver.',
          )}
          refreshButton={{
            label: t('common.refresh', 'Refresh'),
            onRefresh: () => {
              setMonthlyPage(1)
              setMonthlyReloadToken((value) => value + 1)
            },
          }}
          filters={monthlyFilters}
          filterValues={monthlyFilterValues}
          onFiltersApply={(values) => {
            setMonthlyFilterValues(values)
            setMonthlyPage(1)
          }}
          onFiltersClear={() => {
            setMonthlyFilterValues({})
            setMonthlyPage(1)
          }}
          data={monthlyRows}
          columns={monthlyColumns}
          isLoading={monthlyLoading}
          emptyState={t(
            'taxi_fleet.monthlySettlements.driverTab.empty',
            'No monthly settlements yet.',
          )}
          pagination={{
            page: monthlyPage,
            totalPages: monthlyTotalPages,
            total: monthlyTotal,
            pageSize: PAGE_SIZE,
            onPageChange: setMonthlyPage,
          }}
          perspective={{ tableId: 'taxi-fleet-driver-monthly-settlements' }}
          onRowClick={(row) => router.push(monthlyDetailHref(row.id))}
          actions={
            canManageSettlements ? (
              <Button
                type="button"
                size="sm"
                className="inline-flex items-center gap-2"
                onClick={() => setMonthlyGenerateOpen(true)}
              >
                <Plus className="size-4 shrink-0" aria-hidden />
                {t('taxi_fleet.monthlySettlements.generate', 'Generate month')}
              </Button>
            ) : undefined
          }
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  label: t('taxi_fleet.settlements.list.actions.viewDetails', 'View details'),
                  onSelect: () => router.push(monthlyDetailHref(row.id)),
                },
                ...(canManageSettlements && canDeleteMonthlySettlement(row.status)
                  ? [
                      {
                        label: t('common.delete', 'Delete'),
                        destructive: true as const,
                        onSelect: () => void handleDeleteMonthly(row),
                      },
                    ]
                  : []),
              ]}
            />
          )}
        />
      </section>

      <SettlementGenerateDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        teamMemberId={teamMemberId}
        onGenerated={() => setWeeklyReloadToken((value) => value + 1)}
      />
      <MonthlySettlementGenerateDialog
        open={monthlyGenerateOpen}
        onOpenChange={setMonthlyGenerateOpen}
        teamMemberId={teamMemberId}
        onGenerated={() => setMonthlyReloadToken((value) => value + 1)}
      />
      <DriverFinancialEntryDialog
        open={financialDialogOpen}
        onOpenChange={setFinancialDialogOpen}
        teamMemberId={teamMemberId}
        mode={financialDialogMode}
        entry={financialDialogEntry}
        onSaved={() => setEntriesReloadToken((value) => value + 1)}
      />
      {ConfirmDialogElement}
    </div>
  )
}
