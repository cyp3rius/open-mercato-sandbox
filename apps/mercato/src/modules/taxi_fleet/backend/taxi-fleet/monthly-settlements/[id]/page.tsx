'use client'

import * as React from 'react'
import { Banknote, Check, Loader2, RefreshCw, Trash2 } from 'lucide-react'
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
import { SettlementDriverNameLink } from '../../../../components/SettlementDriverNameLink'
import { SettlementAdjustmentsDialog } from '../../../../components/SettlementAdjustmentsDialog'
import { SettlementClosePayoutDialog } from '../../../../components/SettlementClosePayoutDialog'
import { SettlementWeeklyZestawieniePanel } from '../../../../components/SettlementWeeklyZestawieniePanel'
import { MonthlySettlementBasicsPanel } from '../../../../components/MonthlySettlementBasicsPanel'
import { MonthlySettlementDocumentsPanel } from '../../../../components/MonthlySettlementDocumentsPanel'
import { MonthlySettlementTripsPanel } from '../../../../components/MonthlySettlementTripsPanel'
import { MonthlySettlementCostsPanel } from '../../../../components/MonthlySettlementCostsPanel'
import { MonthlySettlementSegmentsPanel } from '../../../../components/MonthlySettlementSegmentsPanel'
import {
  parseMonthlySettlementCosts,
  parseMonthlySettlementSegments,
  parseMonthlySettlementTrips,
} from '../../../../lib/monthlySettlementSnapshot'
import { defaultSettlementDetailValues, type SettlementFormValues } from '../../../../components/settlementFormConfig'
import { isMonthlySettlementLocked } from '../../../../lib/settlementLock'
import {
  canApproveMonthlySettlement,
  canCloseMonthlySettlementPayout,
  canDeleteMonthlySettlement,
} from '../../../../lib/settlementStatusTransitions'
const MONTHLY_CRUD = 'taxi_fleet/monthly-settlements'

type DetailTabId = 'summary' | 'trips' | 'costs' | 'documents'

type MonthlySettlementRow = {
  id: string
  teamMemberId: string
  monthStart: string
  status: string
  closureType?: string | null
  closureAmount?: string | null
  revenueGross?: string
  revenueNet?: string
  costsGross?: string
  costsNet?: string
  netAmount: string
  payoutPercent?: string
  payoutAmount: string
  computedDistanceKm?: string
  totalDistanceKm?: string
  cashExpected?: string
  cashCollected?: string
  bonusAmount?: string
  compensationAmount?: string
  airportA4Amount?: string
  transferAmount?: string
  weeklyCount?: number
  snapshotJson?: Record<string, unknown> | null
}

export default function TaxiFleetMonthlySettlementDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const settlementId = params?.id ?? ''
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const { resolveName, resolveDriverProfileId } = useFleetDriverDirectory()
  const { canManageSettlements } = useTaxiFleetPermissions()
  const [row, setRow] = React.useState<MonthlySettlementRow | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [tab, setTab] = React.useState<DetailTabId>('summary')
  const [isApproving, setIsApproving] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [isRecalculating, setIsRecalculating] = React.useState(false)
  const [adjustmentsOpen, setAdjustmentsOpen] = React.useState(false)
  const [closePayoutOpen, setClosePayoutOpen] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!settlementId) return
    setLoading(true)
    setError(null)
    const call = await apiCall<{ items: MonthlySettlementRow[] }>(
      `/api/taxi_fleet/monthly-settlements?ids=${encodeURIComponent(settlementId)}`,
    )
    const item = call.result?.items?.[0] ?? null
    if (!item) {
      setError(t('taxi_fleet.monthlySettlements.detail.notFound', 'Monthly settlement not found.'))
      setRow(null)
    } else {
      setRow(item)
    }
    setLoading(false)
  }, [settlementId, t])

  React.useEffect(() => {
    void load()
  }, [load])

  const readOnly = !canManageSettlements || isMonthlySettlementLocked(row?.status)

  const titleText = row
    ? `${resolveName(row.teamMemberId)} · ${row.monthStart.slice(0, 7)}`
    : t('taxi_fleet.monthlySettlements.detail.title', 'Monthly settlement')

  const titleNode = row ? (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <SettlementDriverNameLink
        driverProfileId={resolveDriverProfileId(row.teamMemberId)}
        displayName={resolveName(row.teamMemberId)}
        className="text-lg md:text-2xl font-semibold text-foreground hover:text-primary"
      />
      <span className="text-lg md:text-2xl font-semibold tabular-nums">· {row.monthStart.slice(0, 7)}</span>
    </span>
  ) : (
    t('taxi_fleet.monthlySettlements.detail.title', 'Monthly settlement')
  )

  const initialValues = React.useMemo((): SettlementFormValues => {
    if (!row) return defaultSettlementDetailValues()
    return {
      teamMemberId: row.teamMemberId,
      weekStart: row.monthStart,
      status: row.status,
      revenueGross: row.revenueGross ?? '0',
      revenueNet: row.revenueNet ?? '0',
      costsGross: row.costsGross ?? '0',
      costsNet: row.costsNet ?? '0',
      totalRevenue: row.revenueNet ?? '0',
      totalCosts: row.costsNet ?? '0',
      netAmount: row.netAmount,
      payoutPercent: row.payoutPercent ?? '0',
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

  const tripLines = React.useMemo(
    () => parseMonthlySettlementTrips(row?.snapshotJson),
    [row?.snapshotJson],
  )
  const costLines = React.useMemo(
    () => parseMonthlySettlementCosts(row?.snapshotJson),
    [row?.snapshotJson],
  )
  const segments = React.useMemo(
    () => parseMonthlySettlementSegments(row?.snapshotJson),
    [row?.snapshotJson],
  )

  const canApprove = canManageSettlements && row != null && canApproveMonthlySettlement(row.status)
  const canClosePayout = canManageSettlements && row != null && canCloseMonthlySettlementPayout(row.status)
  const canDelete = canManageSettlements && row != null && canDeleteMonthlySettlement(row.status)

  const approveSettlement = React.useCallback(async () => {
    if (!row) return
    setIsApproving(true)
    try {
      await updateCrud(
        MONTHLY_CRUD,
        { id: row.id, status: 'approved' },
        { errorMessage: t('taxi_fleet.monthlySettlements.form.saveError', 'Could not save monthly settlement.') },
      )
      flash(t('taxi_fleet.settlements.approved', 'Settlement approved.'), 'success')
      await load()
    } catch {
      // updateCrud flashes
    } finally {
      setIsApproving(false)
    }
  }, [load, row, t])

  const recalculate = React.useCallback(async () => {
    if (!row || readOnly) return
    setIsRecalculating(true)
    try {
      await updateCrud(
        MONTHLY_CRUD,
        { id: row.id, recalculateSettlement: true },
        { errorMessage: t('taxi_fleet.monthlySettlements.form.saveError', 'Could not save monthly settlement.') },
      )
      flash(t('taxi_fleet.monthlySettlements.recalculated', 'Monthly settlement recalculated.'), 'success')
      await load()
    } finally {
      setIsRecalculating(false)
    }
  }, [load, readOnly, row, t])

  const deleteSettlement = React.useCallback(async () => {
    if (!row) return
    const ok = await confirm({
      title: t('taxi_fleet.monthlySettlements.list.deleteConfirm', 'Delete this draft monthly settlement?'),
      variant: 'destructive',
    })
    if (!ok) return
    setIsDeleting(true)
    try {
      await deleteCrud(MONTHLY_CRUD, row.id, {
        errorMessage: t('taxi_fleet.monthlySettlements.list.deleteError', 'Could not delete monthly settlement.'),
      })
      flash(t('taxi_fleet.monthlySettlements.list.deleteSuccess', 'Monthly settlement deleted.'), 'success')
      router.push(`${TAXI_FLEET_BASE}/settlements-overview/monthly`)
    } finally {
      setIsDeleting(false)
    }
  }, [confirm, row, router, t])

  const headerActions = React.useMemo(() => {
    if (!canApprove && !canClosePayout && !canDelete && readOnly) return null
    return (
      <div className="flex w-full flex-wrap items-center justify-end gap-2 md:ml-auto md:w-auto">
        {canDelete ? (
          <Button type="button" variant="destructive" disabled={isDeleting} onClick={() => void deleteSettlement()}>
            {isDeleting ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : <Trash2 className="mr-2 size-4" aria-hidden />}
            {t('taxi_fleet.settlements.actions.delete', 'Delete draft')}
          </Button>
        ) : null}
        {!readOnly ? (
          <Button type="button" variant="outline" disabled={isRecalculating} onClick={() => void recalculate()}>
            {isRecalculating ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="mr-2 size-4" aria-hidden />
            )}
            {t('taxi_fleet.monthlySettlements.recalculate', 'Recalculate')}
          </Button>
        ) : null}
        {canApprove ? (
          <Button type="button" disabled={isApproving} onClick={() => void approveSettlement()}>
            {isApproving ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : <Check className="mr-2 size-4" aria-hidden />}
            {t('taxi_fleet.settlements.approve', 'Approve')}
          </Button>
        ) : null}
        {canClosePayout ? (
          <Button type="button" onClick={() => setClosePayoutOpen(true)}>
            <Banknote className="mr-2 size-4" aria-hidden />
            {t('taxi_fleet.settlements.closePayout', 'Close / Payout')}
          </Button>
        ) : null}
      </div>
    )
  }, [
    approveSettlement,
    canApprove,
    canClosePayout,
    canDelete,
    deleteSettlement,
    isApproving,
    isDeleting,
    isRecalculating,
    readOnly,
    recalculate,
    t,
  ])

  const tabs = React.useMemo(
    () => [
      { id: 'summary' as const, label: t('taxi_fleet.settlements.detail.tabs.summary', 'Podsumowanie') },
      { id: 'trips' as const, label: t('taxi_fleet.monthlySettlements.detail.tabs.trips', 'Trips') },
      { id: 'costs' as const, label: t('taxi_fleet.monthlySettlements.detail.tabs.costs', 'Costs') },
      {
        id: 'documents' as const,
        label: t('taxi_fleet.monthlySettlements.detail.tabs.documents', 'Month documents'),
      },
    ],
    [t],
  )

  if (loading) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('taxi_fleet.monthlySettlements.detail.loading', 'Loading…')} />
        </PageBody>
      </Page>
    )
  }

  if (error || !row) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage
            label={error ?? t('taxi_fleet.monthlySettlements.detail.notFound', 'Monthly settlement not found.')}
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
            label: 'Monthly settlements',
            labelKey: 'taxi_fleet.monthlySettlements.list.title',
            href: `${TAXI_FLEET_BASE}/settlements-overview/monthly`,
          },
          { label: titleText },
        ]}
        title={titleText}
      />
      <Page>
        <PageBody>
          <FormHeader
            mode="detail"
            backHref={`${TAXI_FLEET_BASE}/settlements-overview/monthly`}
            backLabel={t('taxi_fleet.monthlySettlements.list.title', 'Monthly settlements (payout)')}
            entityTypeLabel={t('taxi_fleet.monthlySettlements.detail.title', 'Monthly settlement')}
            title={titleNode}
            actionsContent={headerActions}
          />

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[7fr_3fr] lg:items-start">
            <div className="min-w-0">
              <DetailTabsLayout<DetailTabId>
                tabs={tabs}
                activeTab={tab}
                onTabChange={setTab}
                navAriaLabel={t('taxi_fleet.monthlySettlements.detail.tabs.nav', 'Monthly settlement sections')}
              >
                {tab === 'summary' ? (
                  <div className="space-y-4">
                    <MonthlySettlementSegmentsPanel segments={segments} />
                  </div>
                ) : null}
                {tab === 'trips' ? <MonthlySettlementTripsPanel trips={tripLines} /> : null}
                {tab === 'costs' ? <MonthlySettlementCostsPanel costs={costLines} /> : null}
                {tab === 'documents' ? (
                  <MonthlySettlementDocumentsPanel monthStart={row.monthStart} canManage={canManageSettlements} />
                ) : null}
              </DetailTabsLayout>
            </div>
            <div className="min-w-0 space-y-4">
              <MonthlySettlementBasicsPanel
                teamMemberId={row.teamMemberId}
                monthStart={row.monthStart}
                status={row.status}
                segmentsCount={segments.length}
                resolveDriverName={resolveName}
                resolveDriverProfileId={resolveDriverProfileId}
              />
              <SettlementWeeklyZestawieniePanel
                revenueNet={String(row.revenueNet ?? '0')}
                costsNet={String(row.costsNet ?? '0')}
                netAmount={String(row.netAmount ?? '0')}
                payoutAmount={String(row.payoutAmount ?? '0')}
                compensationAmount={String(row.compensationAmount ?? '0')}
                bonusAmount={String(row.bonusAmount ?? '0')}
                cashExpected="0"
                cashCollected="0"
                airportA4Amount={String(row.airportA4Amount ?? '0')}
                status={row.status}
                closureType={row.closureType ?? null}
                closureAmount={row.closureAmount ?? null}
                readOnly={readOnly}
                transferOnlyPayout
                onOpenAdjustments={() => setAdjustmentsOpen(true)}
              />
            </div>
          </div>

          <SettlementAdjustmentsDialog
            open={adjustmentsOpen}
            onOpenChange={setAdjustmentsOpen}
            settlementId={row.id}
            initialValues={initialValues}
            readOnly={readOnly}
            crudResource={MONTHLY_CRUD}
            onSaved={load}
          />
          <SettlementClosePayoutDialog
            open={closePayoutOpen}
            onOpenChange={setClosePayoutOpen}
            settlementId={row.id}
            payoutAmount={String(row.payoutAmount ?? '0')}
            cashExpected="0"
            cashCollected="0"
            airportA4Amount={String(row.airportA4Amount ?? '0')}
            crudResource={MONTHLY_CRUD}
            transferOnlyPayout
            onSaved={load}
          />
          {ConfirmDialogElement}
        </PageBody>
      </Page>
    </>
  )
}
