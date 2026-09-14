'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { ApplyBreadcrumb } from '@open-mercato/ui/backend/AppShell'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { FormHeader } from '@open-mercato/ui/backend/forms'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { LoadingMessage, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { deleteCrud, updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { TAXI_FLEET_BASE } from '../../paths'
import { useTaxiFleetPermissions } from '../../../../components/useTaxiFleetPermissions'
import { useResourceLabels } from '../../../../components/useResourceLabels'
import { SettlementStatusBadge } from '../../../../components/SettlementStatusBadge'
import { SettlementCashSummaryPanel } from '../../../../components/SettlementCashSummaryPanel'
import { formatSettlementMoney } from '../../../../lib/settlementPayoutDisplay'
import {
  canApproveVehicleMonthlySettlement,
  canDeleteVehicleMonthlySettlement,
  isVehicleMonthlySettlementLocked,
} from '../../../../lib/settlementStatusTransitions'
import { computeCashVariance } from '../../../../lib/settlementCashVariance'
import { TRIP_REQUEST_PAYMENT_TYPES } from '../../../../lib/tripRequestForm'

const CRUD = 'taxi_fleet/vehicle-monthly-settlements'

type CashTrip = {
  id: string
  startedAt: string | null
  teamMemberId: string | null
  revenueAmount: number
  paymentType: string
}

type Row = {
  id: string
  resourceId: string
  monthStart: string
  status: string
  shiftGpsKm?: string
  tripKm?: string
  emptyKm?: string
  genetaKm?: string | null
  revenueGross?: string
  revenueNet?: string
  bpFuelCost?: string
  cashExpected?: string
  cashReported?: string
  notes?: string | null
  snapshotJson?: Record<string, unknown> | null
}

export default function TaxiFleetVehicleMonthlySettlementDetailPage({
  params,
}: {
  params?: { id?: string }
}) {
  const t = useT()
  const router = useRouter()
  const settlementId = params?.id ?? ''
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const { canManageSettlements } = useTaxiFleetPermissions()
  const [row, setRow] = React.useState<Row | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [cashReportedInput, setCashReportedInput] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!settlementId) return
    setLoading(true)
    setError(null)
    const call = await apiCall<{ items: Row[] }>(
      `/api/taxi_fleet/vehicle-monthly-settlements?ids=${encodeURIComponent(settlementId)}`,
    )
    const item = call.result?.items?.[0] ?? null
    if (!item) {
      setError(t('taxi_fleet.vehicleMonthlySettlements.detail.notFound', 'Vehicle settlement not found.'))
      setRow(null)
    } else {
      setRow(item)
      setCashReportedInput(String(item.cashReported ?? '0'))
    }
    setLoading(false)
  }, [settlementId, t])

  React.useEffect(() => {
    void load()
  }, [load])

  const { resolveLabel } = useResourceLabels(row?.resourceId ? [row.resourceId] : [])
  const readOnly = !canManageSettlements || isVehicleMonthlySettlementLocked(row?.status)
  const titleText = row
    ? `${resolveLabel(row.resourceId)} · ${row.monthStart.slice(0, 7)}`
    : t('taxi_fleet.vehicleMonthlySettlements.detail.title', 'Vehicle settlement')

  const paymentByType = React.useMemo(() => {
    const raw = row?.snapshotJson?.paymentByType
    if (!raw || typeof raw !== 'object') return {}
    return raw as Record<string, number>
  }, [row?.snapshotJson])

  const cashTrips = React.useMemo(() => {
    const raw = row?.snapshotJson?.cashTrips
    return Array.isArray(raw) ? (raw as CashTrip[]) : []
  }, [row?.snapshotJson])

  const cashExpected = Number(row?.cashExpected ?? 0)
  const cashReported = Number(row?.cashReported ?? 0)
  const cashVariance = computeCashVariance(cashReported, cashExpected)
  const bpSyncedAt =
    row?.snapshotJson && typeof row.snapshotJson.bpSyncedAt === 'string'
      ? row.snapshotJson.bpSyncedAt
      : null
  const bpTransactionCount =
    row?.snapshotJson && typeof row.snapshotJson.bpTransactionCount === 'number'
      ? row.snapshotJson.bpTransactionCount
      : null

  async function saveCashReported() {
    if (!row || readOnly) return
    setBusy(true)
    try {
      await updateCrud(
        CRUD,
        { id: row.id, cashReported: Number(cashReportedInput) },
        {
          errorMessage: t(
            'taxi_fleet.vehicleMonthlySettlements.saveError',
            'Could not save vehicle settlement.',
          ),
        },
      )
      flash(t('taxi_fleet.vehicleMonthlySettlements.saved', 'Settlement saved.'), 'success')
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function recalculate() {
    if (!row || readOnly) return
    setBusy(true)
    try {
      await updateCrud(
        CRUD,
        { id: row.id, recalculateSettlement: true },
        {
          errorMessage: t(
            'taxi_fleet.vehicleMonthlySettlements.saveError',
            'Could not save vehicle settlement.',
          ),
        },
      )
      flash(t('taxi_fleet.vehicleMonthlySettlements.recalculated', 'Settlement recalculated.'), 'success')
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function approve() {
    if (!row || !canApproveVehicleMonthlySettlement(row.status)) return
    setBusy(true)
    try {
      await updateCrud(
        CRUD,
        { id: row.id, status: 'approved' },
        {
          errorMessage: t(
            'taxi_fleet.vehicleMonthlySettlements.saveError',
            'Could not save vehicle settlement.',
          ),
        },
      )
      flash(t('taxi_fleet.vehicleMonthlySettlements.approved', 'Settlement approved.'), 'success')
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function syncBp() {
    if (!row || readOnly) return
    setBusy(true)
    try {
      const call = await apiCall<{ bpFuelCost: number; transactionCount: number }>(
        `/api/taxi_fleet/vehicle-monthly-settlements/${encodeURIComponent(row.id)}/sync-bp`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        },
      )
      if (!call.ok) {
        flash(
          (call.result as { error?: string } | null)?.error
            || t(
              'taxi_fleet.vehicleMonthlySettlements.errors.bpSyncFailed',
              'BP Open Fleet sync failed.',
            ),
          'error',
        )
        return
      }
      flash(
        t(
          'taxi_fleet.vehicleMonthlySettlements.bpSynced',
          'BP costs synced ({count} transactions).',
          { count: String(call.result?.transactionCount ?? 0) },
        ),
        'success',
      )
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!row || !canDeleteVehicleMonthlySettlement(row.status)) return
    const ok = await confirm({
      title: t('taxi_fleet.vehicleMonthlySettlements.deleteConfirm', 'Delete this draft vehicle settlement?'),
    })
    if (!ok) return
    setBusy(true)
    try {
      await deleteCrud(CRUD, row.id, {
        errorMessage: t('taxi_fleet.vehicleMonthlySettlements.deleteError', 'Could not delete settlement.'),
      })
      flash(t('taxi_fleet.vehicleMonthlySettlements.deleteSuccess', 'Settlement deleted.'), 'success')
      router.push(`${TAXI_FLEET_BASE}/settlements-overview/vehicles`)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('taxi_fleet.hub.loading', 'Loading…')} />
        </PageBody>
      </Page>
    )
  }

  if (error || !row) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage
            label={error ?? t('taxi_fleet.vehicleMonthlySettlements.detail.notFound', 'Not found.')}
          />
        </PageBody>
      </Page>
    )
  }

  return (
    <>
      <ApplyBreadcrumb
        breadcrumb={[
          { label: 'Dashboard', labelKey: 'taxi_fleet.hub.dashboardTitle', href: TAXI_FLEET_BASE },
          {
            label: 'Settlements',
            labelKey: 'taxi_fleet.settlements.title',
            href: `${TAXI_FLEET_BASE}/settlements-overview`,
          },
          {
            label: 'Vehicle monthly settlements',
            labelKey: 'taxi_fleet.vehicleMonthlySettlements.title',
            href: `${TAXI_FLEET_BASE}/settlements-overview/vehicles`,
          },
          { label: titleText },
        ]}
        title={titleText}
      />
      <Page>
        <PageBody>
          <FormHeader
            mode="detail"
            backHref={`${TAXI_FLEET_BASE}/settlements-overview/vehicles`}
            backLabel={t('taxi_fleet.vehicleMonthlySettlements.title', 'Vehicle monthly settlements')}
            entityTypeLabel={t('taxi_fleet.vehicleMonthlySettlements.detail.title', 'Vehicle settlement')}
            title={titleText}
            actionsContent={
              <div className="flex flex-wrap gap-2">
                {canManageSettlements && !readOnly ? (
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void recalculate()}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                    {t('taxi_fleet.vehicleMonthlySettlements.recalculate', 'Recalculate')}
                  </Button>
                ) : null}
                {canManageSettlements && canApproveVehicleMonthlySettlement(row.status) ? (
                  <Button type="button" size="sm" disabled={busy} onClick={() => void approve()}>
                    <Check className="size-4" />
                    {t('taxi_fleet.settlements.approve', 'Accept')}
                  </Button>
                ) : null}
                {canManageSettlements && canDeleteVehicleMonthlySettlement(row.status) ? (
                  <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={() => void remove()}>
                    <Trash2 className="size-4" />
                    {t('common.delete', 'Delete')}
                  </Button>
                ) : null}
              </div>
            }
          />

          <div className="mt-6 grid gap-4 lg:grid-cols-[7fr_3fr]">
            <div className="space-y-4">
              <section className="rounded-lg border bg-card p-4">
                <h3 className="text-sm font-semibold">
                  {t('taxi_fleet.vehicleMonthlySettlements.revenueByPayment', 'Revenue by payment type')}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(
                    'taxi_fleet.vehicleMonthlySettlements.revenueByPaymentHint',
                    'Only cash trips enter cash variance. Other types are listed separately.',
                  )}
                </p>
                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                  {TRIP_REQUEST_PAYMENT_TYPES.map((paymentType) => {
                    const amount = Number(paymentByType[paymentType] ?? 0)
                    if (amount <= 0 && paymentType !== 'cash') return null
                    return (
                      <div key={paymentType} className="rounded-md border px-3 py-2">
                        <dt className="text-xs text-muted-foreground">
                          {t(`taxi_fleet.trips.form.paymentTypes.${paymentType}`, paymentType)}
                        </dt>
                        <dd className="text-sm font-medium tabular-nums">{formatSettlementMoney(amount)}</dd>
                      </div>
                    )
                  })}
                </dl>
              </section>

              <SettlementCashSummaryPanel
                cashExpected={String(cashExpected)}
                cashCollected={String(cashReported)}
                readOnly
              />
              <p className="text-sm text-muted-foreground">
                {t('taxi_fleet.vehicleMonthlySettlements.cashVariance', 'Cash variance')}:{' '}
                <span className="font-medium tabular-nums text-foreground">{formatSettlementMoney(cashVariance)}</span>
              </p>

              <section className="rounded-lg border bg-card p-4">
                <h3 className="text-sm font-semibold">
                  {t('taxi_fleet.vehicleMonthlySettlements.cashTrips', 'Cash trips (CRM)')}
                </h3>
                {cashTrips.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t('taxi_fleet.vehicleMonthlySettlements.cashTripsEmpty', 'No cash trips in this month.')}
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {cashTrips.map((trip) => (
                      <li key={trip.id}>
                        <Link
                          href={`${TAXI_FLEET_BASE}/trips/${encodeURIComponent(trip.id)}`}
                          className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm hover:bg-muted/40"
                        >
                          <span className="text-muted-foreground">
                            {trip.startedAt ? new Date(trip.startedAt).toLocaleString() : trip.id}
                          </span>
                          <span className="font-medium tabular-nums">{formatSettlementMoney(trip.revenueAmount)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">
                      {t('taxi_fleet.vehicleMonthlySettlements.bpCosts', 'BP fleet card costs')}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t(
                        'taxi_fleet.vehicleMonthlySettlements.bpCostsHint',
                        'Gross invoice amount from BP Open Fleet, matched by fuel card number on the taxi resource.',
                      )}
                    </p>
                  </div>
                  {canManageSettlements && !readOnly ? (
                    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void syncBp()}>
                      {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                      {t('taxi_fleet.vehicleMonthlySettlements.syncBp', 'Sync BP costs')}
                    </Button>
                  ) : null}
                </div>
                <p className="text-sm tabular-nums font-medium">{formatSettlementMoney(row.bpFuelCost ?? 0)}</p>
                <p className="text-xs text-muted-foreground">
                  {bpTransactionCount != null
                    ? t(
                        'taxi_fleet.vehicleMonthlySettlements.bpTxCount',
                        '{count} matched transactions',
                        { count: String(bpTransactionCount) },
                      )
                    : t('taxi_fleet.vehicleMonthlySettlements.bpNotSynced', 'Not synced yet.')}
                  {bpSyncedAt ? ` · ${bpSyncedAt.slice(0, 19).replace('T', ' ')}` : ''}
                </p>
              </section>
            </div>

            <div className="space-y-4">
              <section className="rounded-lg border bg-card p-4 space-y-3">
                <h3 className="text-sm font-semibold">{t('taxi_fleet.form.groups.basics', 'Basics')}</h3>
                <div>
                  <div className="text-xs text-muted-foreground">
                    {t('taxi_fleet.vehicleMonthlySettlements.vehicle', 'Vehicle')}
                  </div>
                  <div className="text-sm font-medium">{resolveLabel(row.resourceId)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    {t('taxi_fleet.vehicleMonthlySettlements.monthStart', 'Month')}
                  </div>
                  <div className="text-sm font-medium tabular-nums">{row.monthStart.slice(0, 7)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    {t('taxi_fleet.vehicleMonthlySettlements.status', 'Status')}
                  </div>
                  <SettlementStatusBadge status={row.status} />
                </div>
              </section>

              <section className="rounded-lg border bg-card p-4 space-y-2">
                <h3 className="text-sm font-semibold">
                  {t('taxi_fleet.vehicleMonthlySettlements.distance', 'Distance')}
                </h3>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('taxi_fleet.vehicleMonthlySettlements.shiftGpsKm', 'GPS km')}
                  </span>
                  <span className="tabular-nums">{row.shiftGpsKm ?? '0'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('taxi_fleet.vehicleMonthlySettlements.tripKm', 'Trip km')}
                  </span>
                  <span className="tabular-nums">{row.tripKm ?? '0'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('taxi_fleet.vehicleMonthlySettlements.emptyKm', 'Empty km')}
                  </span>
                  <span className="tabular-nums">{row.emptyKm ?? '0'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('taxi_fleet.vehicleMonthlySettlements.genetaKm', 'Geneta km')}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {row.genetaKm ?? t('taxi_fleet.settlements.vehicles.comingSoon', 'Coming soon')}
                  </span>
                </div>
              </section>

              <section className="rounded-lg border bg-card p-4 space-y-3">
                <h3 className="text-sm font-semibold">
                  {t('taxi_fleet.vehicleMonthlySettlements.cashReported', 'Cash register (manual)')}
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="cash-reported">
                    {t('taxi_fleet.vehicleMonthlySettlements.cashReported', 'Cash register (manual)')}
                  </Label>
                  <Input
                    id="cash-reported"
                    type="number"
                    min={0}
                    step="0.01"
                    value={cashReportedInput}
                    disabled={readOnly || busy}
                    onChange={(event) => setCashReportedInput(event.target.value)}
                  />
                </div>
                {!readOnly ? (
                  <Button type="button" size="sm" disabled={busy} onClick={() => void saveCashReported()}>
                    {t('common.save', 'Save')}
                  </Button>
                ) : null}
              </section>
            </div>
          </div>
          {ConfirmDialogElement}
        </PageBody>
      </Page>
    </>
  )
}
