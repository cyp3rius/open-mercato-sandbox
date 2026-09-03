'use client'

import * as React from 'react'
import { Banknote, Check, Loader2, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ApplyBreadcrumb } from '@open-mercato/ui/backend/AppShell'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { FormHeader } from '@open-mercato/ui/backend/forms'
import { Button } from '@open-mercato/ui/primitives/button'
import { LoadingMessage, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { deleteCrud, updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { DetailTabsLayout } from '@open-mercato/core/modules/customers/components/detail/DetailTabsLayout'
import { TAXI_FLEET_BASE } from '../../paths'
import { useFleetDriverDirectory } from '../../../../components/useFleetDriverDirectory'
import { useTaxiFleetPermissions } from '../../../../components/useTaxiFleetPermissions'
import { SettlementBasicsPanel } from '../../../../components/SettlementBasicsPanel'
import { SettlementDriverNameLink } from '../../../../components/SettlementDriverNameLink'
import { SettlementAdjustmentsDialog } from '../../../../components/SettlementAdjustmentsDialog'
import { SettlementClosePayoutDialog } from '../../../../components/SettlementClosePayoutDialog'
import { SettlementCashPanel } from '../../../../components/SettlementCashPanel'
import { SettlementTripDistancePanel } from '../../../../components/SettlementTripDistancePanel'
import { SettlementRevenueBreakdownPanel } from '../../../../components/SettlementRevenueBreakdownPanel'
import { SettlementCostsBreakdownPanel, parseSettlementCostBreakdown } from '../../../../components/SettlementCostsBreakdownPanel'
import { SettlementIncomeReconciliationPanel, parseIncomeReconciliationSummary } from '../../../../components/SettlementIncomeReconciliationPanel'
import { SettlementIndicatorsPanel } from '../../../../components/SettlementIndicatorsPanel'
import { SettlementWeeklyZestawieniePanel } from '../../../../components/SettlementWeeklyZestawieniePanel'
import { SettlementTripsToReconcilePanel } from '../../../../components/SettlementTripsToReconcilePanel'
import { SettlementCostsToReconcilePanel } from '../../../../components/SettlementCostsToReconcilePanel'
import { emptySettlementRevenueBreakdown } from '../../../../lib/settlementRevenueBreakdown'
import { parseSettlementRevenueBreakdown } from '../../../../lib/settlementSnapshot'
import { parseSettlementCostExclusions } from '../../../../lib/settlementCostExclusions'
import type { SettlementTripSnapshot } from '../../../../lib/settlementTripDistance'
import { useTaxiFleetSettings } from '../../../../components/useTaxiFleetSettings'
import { defaultSettlementDetailValues, type SettlementFormValues } from '../../../../components/settlementFormConfig'
import { isWeeklySettlementLocked } from '../../../../lib/settlementLock'
import {
  canApproveWeeklySettlement,
  canCloseWeeklySettlementPayout,
  canDeleteWeeklySettlement,
} from '../../../../lib/settlementStatusTransitions'
import { formatWeekRange } from '../../../../lib/weekUtils'

type SettlementDetailTabId = 'summary' | 'trips' | 'costs' | 'documents'

type SettlementRow = {
  id: string
  teamMemberId: string
  weekStart: string
  status: string
  closureType?: string | null
  closureAmount?: string | null
  revenueGross?: string
  revenueNet?: string
  costsGross?: string
  costsNet?: string
  totalRevenue: string
  totalCosts: string
  netAmount: string
  payoutPercent: string
  payoutAmount: string
  computedDistanceKm?: string
  totalDistanceKm?: string
  emptyDistanceKm?: string
  cashExpected?: string
  cashCollected?: string
  bonusAmount?: string
  compensationAmount?: string
  airportA4Amount?: string
  transferAmount?: string
  snapshotJson?: Record<string, unknown> | null
}

function parseSettlementTrips(snapshotJson?: Record<string, unknown> | null): SettlementTripSnapshot[] {
  const raw = snapshotJson?.trips
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is SettlementTripSnapshot => {
    if (!item || typeof item !== 'object') return false
    const trip = item as Partial<SettlementTripSnapshot>
    return typeof trip.id === 'string'
  }).map((trip) => ({
    ...trip,
    revenueAmount: trip.revenueAmount ?? null,
    missingPlatform: trip.missingPlatform ?? false,
    missingIncomeReceipt: trip.missingIncomeReceipt ?? false,
  }))
}

export default function TaxiFleetSettlementDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const settlementId = params?.id ?? ''
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const { resolveName } = useFleetDriverDirectory()
  const { canManageSettlements } = useTaxiFleetPermissions()
  const { settings: fleetSettings } = useTaxiFleetSettings()
  const [row, setRow] = React.useState<SettlementRow | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [tab, setTab] = React.useState<SettlementDetailTabId>('summary')
  const [isApproving, setIsApproving] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [closePayoutOpen, setClosePayoutOpen] = React.useState(false)
  const [adjustmentsOpen, setAdjustmentsOpen] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!settlementId) return
    setLoading(true)
    setError(null)
    const call = await apiCall<{ items: SettlementRow[] }>(
      `/api/taxi_fleet/settlements?ids=${encodeURIComponent(settlementId)}`,
    )
    const item = call.result?.items?.[0] ?? null
    if (!item) {
      setError(t('taxi_fleet.settlements.detail.notFound', 'Settlement not found.'))
      setRow(null)
    } else {
      setRow(item)
    }
    setLoading(false)
  }, [settlementId, t])

  React.useEffect(() => {
    void load()
  }, [load])

  const readOnly = !canManageSettlements || isWeeklySettlementLocked(row?.status)
  const canEditCash = canManageSettlements && !readOnly

  const titleText = row
    ? `${resolveName(row.teamMemberId)} · ${formatWeekRange(row.weekStart)}`
    : t('taxi_fleet.settlements.detail.title', 'Settlement')

  const titleNode = row ? (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <SettlementDriverNameLink
        teamMemberId={row.teamMemberId}
        displayName={resolveName(row.teamMemberId)}
        className="text-lg md:text-2xl font-semibold text-foreground hover:text-primary"
      />
      <span className="text-lg md:text-2xl font-semibold tabular-nums">· {formatWeekRange(row.weekStart)}</span>
    </span>
  ) : (
    t('taxi_fleet.settlements.detail.title', 'Settlement')
  )

  const initialValues = React.useMemo((): SettlementFormValues => {
    if (!row) return defaultSettlementDetailValues()
    return {
      teamMemberId: row.teamMemberId,
      weekStart: row.weekStart,
      status: row.status,
      revenueGross: row.revenueGross ?? row.totalRevenue,
      revenueNet: row.revenueNet ?? row.totalRevenue,
      costsGross: row.costsGross ?? row.totalCosts,
      costsNet: row.costsNet ?? row.totalCosts,
      totalRevenue: row.totalRevenue,
      totalCosts: row.totalCosts,
      netAmount: row.netAmount,
      payoutPercent: row.payoutPercent,
      payoutAmount: row.payoutAmount,
      computedDistanceKm: row.computedDistanceKm ?? '0',
      totalDistanceKm: row.totalDistanceKm ?? row.computedDistanceKm ?? '0',
      cashExpected: row.cashExpected ?? '0',
      cashCollected: row.cashCollected ?? '0',
      bonusAmount: row.bonusAmount ?? '0',
      compensationAmount: row.compensationAmount ?? '0',
      airportA4Amount: row.airportA4Amount ?? '0',
      transferAmount: row.transferAmount ?? '0',
      totalAmount: '0',
    }
  }, [row])

  const trips = React.useMemo(() => parseSettlementTrips(row?.snapshotJson), [row?.snapshotJson])
  const revenueBreakdown = React.useMemo(
    () => parseSettlementRevenueBreakdown(row?.snapshotJson) ?? emptySettlementRevenueBreakdown(),
    [row?.snapshotJson],
  )
  const costBreakdown = React.useMemo(
    () => parseSettlementCostBreakdown(row?.snapshotJson),
    [row?.snapshotJson],
  )
  const excludedCosts = React.useMemo(
    () => parseSettlementCostExclusions(row?.snapshotJson),
    [row?.snapshotJson],
  )
  const incomeReconciliation = React.useMemo(
    () => parseIncomeReconciliationSummary(row?.snapshotJson, trips),
    [row?.snapshotJson, trips],
  )
  const indicatorProps = React.useMemo(() => {
    if (!row) {
      return { fuelPerKm: null as number | null, revenuePerKm: null as number | null, totalDistanceKm: '0' }
    }
    const fuelCostNet = Number(row.snapshotJson?.fuelCostNet ?? 0)
    const totalKm = Number(row.totalDistanceKm ?? row.computedDistanceKm ?? 0)
    const revenueNetNum = Number(row.revenueNet ?? row.totalRevenue ?? 0)
    return {
      fuelPerKm: totalKm > 0 && Number.isFinite(fuelCostNet) ? fuelCostNet / totalKm : null,
      revenuePerKm: totalKm > 0 && Number.isFinite(revenueNetNum) ? revenueNetNum / totalKm : null,
      totalDistanceKm: row.totalDistanceKm ?? row.computedDistanceKm ?? '0',
    }
  }, [row])

  const openTripsTab = React.useCallback(() => {
    setTab('trips')
  }, [])

  const openCostsTab = React.useCallback(() => {
    setTab('costs')
  }, [])

  const canApprove = canManageSettlements && row != null && canApproveWeeklySettlement(row.status)
  const canClosePayout = canManageSettlements && row != null && canCloseWeeklySettlementPayout(row.status)
  const canDelete = canManageSettlements && row != null && canDeleteWeeklySettlement(row.status)

  const openAdjustments = React.useCallback(() => {
    setAdjustmentsOpen(true)
  }, [])

  const approveSettlement = React.useCallback(async () => {
    if (!row) return
    setIsApproving(true)
    try {
      await updateCrud(
        'taxi_fleet/settlements',
        { id: row.id, status: 'approved' },
        {
          errorMessage: t(
            'taxi_fleet.errors.settlementMissingDocumentNumbers',
            'Cannot approve settlement: some trips are missing receipt document numbers.',
          ),
        },
      )
      flash(t('taxi_fleet.settlements.approved', 'Settlement approved.'), 'success')
      await load()
    } catch {
      // updateCrud already flashes the server/error message
    } finally {
      setIsApproving(false)
    }
  }, [load, row, t])

  const openClosePayout = React.useCallback(() => {
    setClosePayoutOpen(true)
  }, [])

  const deleteSettlement = React.useCallback(async () => {
    if (!row) return
    const ok = await confirm({
      title: t('taxi_fleet.settlements.list.deleteConfirm', 'Delete this draft settlement?'),
      variant: 'destructive',
    })
    if (!ok) return
    setIsDeleting(true)
    try {
      await deleteCrud('taxi_fleet/settlements', row.id, {
        errorMessage: t('taxi_fleet.settlements.list.deleteError', 'Could not delete settlement.'),
      })
      flash(t('taxi_fleet.settlements.list.deleteSuccess', 'Settlement deleted.'), 'success')
      router.push(`${TAXI_FLEET_BASE}/settlements-overview/weekly`)
    } finally {
      setIsDeleting(false)
    }
  }, [confirm, row, router, t])

  const headerActions = React.useMemo(() => {
    if (!canApprove && !canClosePayout && !canDelete) return null
    return (
      <div className="flex w-full flex-wrap items-center justify-end gap-2 md:ml-auto md:w-auto">
        {canDelete ? (
          <Button
            type="button"
            variant="destructive"
            disabled={isDeleting}
            onClick={() => void deleteSettlement()}
          >
            {isDeleting ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="mr-2 size-4" aria-hidden />
            )}
            {t('taxi_fleet.settlements.actions.delete', 'Delete draft')}
          </Button>
        ) : null}
        {canApprove ? (
          <Button type="button" disabled={isApproving} onClick={() => void approveSettlement()}>
            {isApproving ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            ) : (
              <Check className="mr-2 size-4" aria-hidden />
            )}
            {t('taxi_fleet.settlements.approve', 'Approve')}
          </Button>
        ) : null}
        {canClosePayout ? (
          <Button type="button" onClick={openClosePayout}>
            <Banknote className="mr-2 size-4" aria-hidden />
            {t('taxi_fleet.settlements.closePayout', 'Close / Payout')}
          </Button>
        ) : null}
      </div>
    )
  }, [approveSettlement, canApprove, canClosePayout, canDelete, deleteSettlement, isApproving, isDeleting, openClosePayout, t])

  const tabs = React.useMemo(
    () => [
      { id: 'summary' as const, label: t('taxi_fleet.settlements.detail.tabs.summary', 'Podsumowanie') },
      { id: 'trips' as const, label: t('taxi_fleet.settlements.detail.tabs.trips', 'Kursy do rozliczenia') },
      { id: 'costs' as const, label: t('taxi_fleet.settlements.detail.tabs.costs', 'Koszty do rozliczenia') },
      {
        id: 'documents' as const,
        label: t('taxi_fleet.settlements.detail.tabs.documents', 'Dokumenty rozliczeniowe'),
      },
    ],
    [t],
  )

  if (loading) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('taxi_fleet.settlements.detail.loading', 'Loading…')} />
        </PageBody>
      </Page>
    )
  }

  if (error || !row) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={error ?? t('taxi_fleet.settlements.detail.notFound', 'Settlement not found.')} />
        </PageBody>
      </Page>
    )
  }

  return (
    <>
      <ApplyBreadcrumb
        breadcrumb={[
          { label: 'Dashboard', labelKey: 'taxi_fleet.hub.dashboardTitle', href: TAXI_FLEET_BASE },
          { label: 'Settlements', labelKey: 'taxi_fleet.settlements.list.title', href: `${TAXI_FLEET_BASE}/settlements-overview/weekly` },
          { label: titleText },
        ]}
        title={titleText}
      />
      <Page>
        <PageBody>
          <FormHeader
            mode="detail"
            backHref={`${TAXI_FLEET_BASE}/settlements-overview/weekly`}
            backLabel={t('taxi_fleet.settlements.list.title', 'Settlements')}
            entityTypeLabel={t('taxi_fleet.settlements.detail.title', 'Settlement')}
            title={titleNode}
            actionsContent={headerActions}
          />

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[7fr_3fr] lg:items-start">
            <div className="min-w-0">
              <DetailTabsLayout<SettlementDetailTabId>
                tabs={tabs}
                activeTab={tab}
                onTabChange={setTab}
                navAriaLabel={t('taxi_fleet.settlements.detail.tabs.nav', 'Settlement sections')}
                panelContentKey={tab}
              >
                {tab === 'summary' ? (
                  <div className="space-y-4">
                    <SettlementRevenueBreakdownPanel
                      breakdown={revenueBreakdown}
                      revenueGross={row.revenueGross ?? row.totalRevenue}
                      revenueNet={row.revenueNet ?? row.totalRevenue}
                      onOpenTripsTab={openTripsTab}
                    />
                    <SettlementCostsBreakdownPanel
                      costBreakdown={costBreakdown}
                      costsGross={row.costsGross ?? row.totalCosts}
                      costsNet={row.costsNet ?? row.totalCosts}
                      onOpenCostsTab={openCostsTab}
                    />
                  </div>
                ) : null}

                {tab === 'trips' ? (
                  <div className="space-y-4">
                    <SettlementTripsToReconcilePanel
                      trips={trips}
                      settlementId={row.id}
                      readOnly={readOnly}
                      onUpdated={load}
                    />
                    <SettlementRevenueBreakdownPanel
                      titleMode="summary"
                      breakdown={revenueBreakdown}
                      revenueGross={row?.revenueGross ?? row?.totalRevenue ?? '0'}
                      revenueNet={row?.revenueNet ?? row?.totalRevenue ?? '0'}
                    />
                  </div>
                ) : null}

                {tab === 'costs' ? (
                  <div className="space-y-4">
                    {row ? (
                      <SettlementCostsToReconcilePanel
                        settlementId={row.id}
                        teamMemberId={row.teamMemberId}
                        weekStart={row.weekStart}
                        readOnly={readOnly}
                        excludedCosts={excludedCosts}
                        onUpdated={load}
                      />
                    ) : null}
                    <SettlementCostsBreakdownPanel
                      titleMode="summary"
                      costBreakdown={costBreakdown}
                      costsGross={row?.costsGross ?? row?.totalCosts ?? '0'}
                      costsNet={row?.costsNet ?? row?.totalCosts ?? '0'}
                    />
                  </div>
                ) : null}

                {tab === 'documents' ? (
                  <SettlementIncomeReconciliationPanel trips={trips} summary={incomeReconciliation} />
                ) : null}
              </DetailTabsLayout>
            </div>

            <div className="min-w-0 space-y-4">
              <SettlementBasicsPanel
                values={{
                  teamMemberId: row.teamMemberId,
                  weekStart: row.weekStart,
                  status: row.status,
                  payoutPercent: row.payoutPercent,
                }}
                resolveDriverName={resolveName}
                payoutMeta={
                  row.snapshotJson?.payout && typeof row.snapshotJson.payout === 'object'
                    ? (row.snapshotJson.payout as Record<string, unknown>)
                    : null
                }
              />
              <SettlementTripDistancePanel
                settlementId={row.id}
                trips={trips}
                computedDistanceKm={row.computedDistanceKm ?? '0'}
                totalDistanceKm={row.totalDistanceKm ?? row.computedDistanceKm ?? '0'}
                emptyDistanceKm={row.emptyDistanceKm ?? '0'}
                gpsDistanceKm={
                  typeof row.snapshotJson?.gpsDistanceKm === 'number'
                    ? String(row.snapshotJson.gpsDistanceKm)
                    : typeof row.snapshotJson?.gpsDistanceKm === 'string'
                      ? row.snapshotJson.gpsDistanceKm
                      : row.totalDistanceKm ?? '0'
                }
                readOnly={readOnly}
                onUpdated={load}
                onOpenTripsTab={openTripsTab}
              />
              <SettlementIndicatorsPanel
                {...indicatorProps}
                fuelRange={fleetSettings.settlementIndicatorRanges.fuelPerKm}
                revenueRange={fleetSettings.settlementIndicatorRanges.revenuePerKm}
              />
              <SettlementCashPanel
                settlementId={row.id}
                cashExpected={initialValues.cashExpected}
                cashCollected={initialValues.cashCollected}
                readOnly={!canEditCash}
                onUpdated={load}
              />
              <SettlementWeeklyZestawieniePanel
                revenueNet={String(row.revenueNet ?? row.totalRevenue ?? '0')}
                costsNet={String(row.costsNet ?? row.totalCosts ?? '0')}
                netAmount={String(row.netAmount ?? '0')}
                payoutAmount={String(row.payoutAmount ?? '0')}
                compensationAmount={String(row.compensationAmount ?? '0')}
                bonusAmount={String(row.bonusAmount ?? '0')}
                cashExpected={String(row.cashExpected ?? '0')}
                cashCollected={String(row.cashCollected ?? '0')}
                airportA4Amount={String(row.airportA4Amount ?? '0')}
                status={row.status}
                closureType={row.closureType ?? null}
                closureAmount={row.closureAmount ?? null}
                readOnly={readOnly}
                onOpenAdjustments={openAdjustments}
              />
            </div>
          </div>

          <SettlementAdjustmentsDialog
            open={adjustmentsOpen}
            onOpenChange={setAdjustmentsOpen}
            settlementId={row.id}
            initialValues={initialValues}
            readOnly={readOnly}
            onSaved={load}
          />
          <SettlementClosePayoutDialog
            open={closePayoutOpen}
            onOpenChange={setClosePayoutOpen}
            settlementId={row.id}
            payoutAmount={String(row.payoutAmount ?? '0')}
            cashExpected={String(row.cashExpected ?? '0')}
            cashCollected={String(row.cashCollected ?? '0')}
            airportA4Amount={String(row.airportA4Amount ?? '0')}
            onSaved={load}
          />
          {ConfirmDialogElement}
        </PageBody>
      </Page>
    </>
  )
}
