"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
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
import {
  DriverFinancialEntryDialog,
  type FinancialEntryRow,
} from '../DriverFinancialEntryDialog'
import { TripCustomerPreview } from '../TripCustomerPreview'

type SettlementRow = {
  id: string
  weekStart: string
  status: string
  payoutAmount: string
  netAmount: string
}

type DriverSettlementsTabProps = {
  teamMemberId: string
  canManageSettlements: boolean
}

export function DriverSettlementsTab({
  teamMemberId,
  canManageSettlements,
}: DriverSettlementsTabProps) {
  const t = useT()
  const router = useRouter()
  const scopeVersion = useOrganizationScopeVersion()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const { resolveSettlementStatusLabel, resolveIncomeDocumentTypeLabel, resolveCostTypeLabel } = useTaxiFleetLabels()
  const [entries, setEntries] = React.useState<FinancialEntryRow[]>([])
  const [settlements, setSettlements] = React.useState<SettlementRow[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [reloadToken, setReloadToken] = React.useState(0)
  const [generateOpen, setGenerateOpen] = React.useState(false)
  const [financialDialogOpen, setFinancialDialogOpen] = React.useState(false)
  const [financialDialogMode, setFinancialDialogMode] = React.useState<'income' | 'expense'>('income')
  const [financialDialogEntry, setFinancialDialogEntry] = React.useState<FinancialEntryRow | null>(null)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      const entryParams = new URLSearchParams({
        page: '1',
        pageSize: '200',
        teamMemberId,
        sortField: 'occurredAt',
        sortDir: 'desc',
      })
      const settlementParams = new URLSearchParams({
        page: '1',
        pageSize: '50',
        teamMemberId,
      })
      const [entryCall, settlementCall] = await Promise.all([
        apiCall<{ items: FinancialEntryRow[] }>(`/api/taxi_fleet/financial-entries?${entryParams}`),
        apiCall<{ items: SettlementRow[] }>(`/api/taxi_fleet/settlements?${settlementParams}`),
      ])
      if (cancelled) return
      setEntries(Array.isArray(entryCall.result?.items) ? entryCall.result.items : [])
      setSettlements(Array.isArray(settlementCall.result?.items) ? settlementCall.result.items : [])
      setIsLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [reloadToken, scopeVersion, teamMemberId])

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

  const handleDelete = React.useCallback(
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
      setReloadToken((value) => value + 1)
    },
    [confirm, t],
  )

  const entryColumns = React.useMemo<ColumnDef<FinancialEntryRow>[]>(
    () => [
      {
        accessorKey: 'occurredAt',
        header: t('taxi_fleet.settlements.ledger.date', 'Date'),
        cell: ({ row }) => formatDateTime(row.original.occurredAt ?? '') ?? row.original.occurredAt ?? '—',
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
        header: t('taxi_fleet.trips.customer', 'Customer'),
        cell: ({ row }) =>
          row.original.kind === 'income' ? (
            <TripCustomerPreview
              customerPersonId={row.original.customerPersonId}
              customerCompanyId={row.original.customerCompanyId}
            />
          ) : (
            '—'
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
        cell: ({ row }) => row.original.weekStart,
      },
      {
        accessorKey: 'status',
        header: t('taxi_fleet.settlements.status', 'Status'),
        cell: ({ row }) => resolveSettlementStatusLabel(row.original.status),
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
    [resolveSettlementStatusLabel, t],
  )

  const settlementDetailHref = (id: string) => `${TAXI_FLEET_BASE}/settlements/${encodeURIComponent(id)}`

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">{t('taxi_fleet.financial.title', 'Receipts, invoices & costs')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('taxi_fleet.financial.description', 'Register customer receipts/invoices and driver costs with document numbers.')}
            </p>
          </div>
          {canManageSettlements ? (
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
          ) : null}
        </div>
        <div className="mt-4">
          <DataTable<FinancialEntryRow>
            embedded
            data={entries}
            columns={entryColumns}
            isLoading={isLoading}
            emptyState={t('taxi_fleet.financial.empty', 'No receipts, invoices, or costs registered yet.')}
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
                          onSelect: () => void handleDelete(row),
                        },
                      ]}
                    />
                  )
                : undefined
            }
          />
        </div>
      </section>
      <section className="rounded-lg border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">{t('taxi_fleet.settlements.weeklyTitle', 'Weekly settlements')}</h3>
          {canManageSettlements ? (
            <Button
              type="button"
              size="sm"
              className="inline-flex items-center gap-2"
              onClick={() => setGenerateOpen(true)}
            >
              <Plus className="size-4 shrink-0" aria-hidden />
              {t('taxi_fleet.drivers.tabs.settlements.addSettlement', 'Generate settlement')}
            </Button>
          ) : null}
        </div>
        <div className="mt-4">
          <DataTable<SettlementRow>
            embedded
            data={settlements}
            columns={settlementColumns}
            isLoading={isLoading}
            emptyState={t('taxi_fleet.settlements.empty', 'No settlements yet.')}
            onRowClick={(row) => router.push(settlementDetailHref(row.id))}
          />
        </div>
      </section>
      <SettlementGenerateDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        teamMemberId={teamMemberId}
        onGenerated={() => setReloadToken((value) => value + 1)}
      />
      <DriverFinancialEntryDialog
        open={financialDialogOpen}
        onOpenChange={setFinancialDialogOpen}
        teamMemberId={teamMemberId}
        mode={financialDialogMode}
        entry={financialDialogEntry}
        onSaved={() => setReloadToken((value) => value + 1)}
      />
      {ConfirmDialogElement}
    </div>
  )
}
