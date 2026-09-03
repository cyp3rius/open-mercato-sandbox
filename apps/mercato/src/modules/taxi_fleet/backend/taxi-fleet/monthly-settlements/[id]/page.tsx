'use client'

import * as React from 'react'
import Link from 'next/link'
import { ApplyBreadcrumb } from '@open-mercato/ui/backend/AppShell'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { Button } from '@open-mercato/ui/primitives/button'
import { LoadingMessage, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { CrudField, CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { TAXI_FLEET_BASE } from '../../paths'
import { useFleetDriverDirectory } from '../../../../components/useFleetDriverDirectory'
import { useTaxiFleetPermissions } from '../../../../components/useTaxiFleetPermissions'
import { SettlementRevenueBreakdownPanel } from '../../../../components/SettlementRevenueBreakdownPanel'
import { SettlementCashSummaryPanel } from '../../../../components/SettlementCashSummaryPanel'
import {
  MonthlySettlementDriverBreakdownPanel,
  parseMonthlyDriverBreakdown,
} from '../../../../components/MonthlySettlementDriverBreakdownPanel'
import { emptySettlementRevenueBreakdown } from '../../../../lib/settlementRevenueBreakdown'
import { parseSettlementRevenueBreakdown } from '../../../../lib/settlementSnapshot'

type MonthlySettlementRow = {
  id: string
  monthStart: string
  status: string
  revenueGross?: string
  revenueNet?: string
  costsGross?: string
  costsNet?: string
  netAmount?: string
  payoutAmount?: string
  totalDistanceKm?: string
  cashExpected?: string
  cashCollected?: string
  bonusAmount?: string
  compensationAmount?: string
  airportA4Amount?: string
  transferAmount?: string
  weeklyCount?: number
  driverCount?: number
  notes?: string | null
  snapshotJson?: Record<string, unknown> | null
}

type MonthlyFormValues = {
  monthStart: string
  status: string
  revenueGross: string
  revenueNet: string
  costsGross: string
  costsNet: string
  netAmount: string
  payoutAmount: string
  totalDistanceKm: string
  cashExpected: string
  cashCollected: string
  bonusAmount: string
  compensationAmount: string
  airportA4Amount: string
  transferAmount: string
  totalAmount: string
  weeklyCount: string
  driverCount: string
  notes: string
}

function formatMoney(value: string | number): string {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '—'
  return `${parsed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN`
}

function buildMonthlyDetailGroups(t: ReturnType<typeof useT>): CrudFormGroup[] {
  return [
    {
      id: 'basics',
      title: t('taxi_fleet.settlements.form.groups.basics', 'Basics'),
      column: 1,
      fields: ['monthStart', 'status', 'weeklyCount', 'driverCount', 'notes'],
    },
    {
      id: 'amounts',
      title: t('taxi_fleet.settlements.form.groups.amounts', 'Amounts'),
      column: 2,
      fields: [
        'revenueGross',
        'revenueNet',
        'costsGross',
        'costsNet',
        'netAmount',
        'payoutAmount',
        'totalDistanceKm',
      ],
    },
    {
      id: 'operator',
      title: t('taxi_fleet.settlements.form.groups.operator', 'Cash & adjustments'),
      column: 2,
      fields: [
        'cashExpected',
        'cashCollected',
        'bonusAmount',
        'compensationAmount',
        'airportA4Amount',
        'transferAmount',
        'totalAmount',
      ],
    },
  ]
}

function buildMonthlyDetailFields(t: ReturnType<typeof useT>, readOnly: boolean): CrudField[] {
  const statusOptions = ['draft', 'approved', 'closed'].map((status) => ({
    value: status,
    label: t(`taxi_fleet.monthlySettlements.statuses.${status}`, status),
  }))
  const readOnlyField = { readOnly: true as const }
  return [
    { id: 'monthStart', type: 'text', label: t('taxi_fleet.monthlySettlements.monthStart', 'Month'), layout: 'half', ...readOnlyField },
    { id: 'status', type: 'select', label: t('taxi_fleet.settlements.status', 'Status'), layout: 'half', options: statusOptions, readOnly },
    { id: 'weeklyCount', type: 'text', label: t('taxi_fleet.monthlySettlements.weeklyCount', 'Weeks'), layout: 'half', ...readOnlyField },
    { id: 'driverCount', type: 'text', label: t('taxi_fleet.monthlySettlements.driverCount', 'Drivers'), layout: 'half', ...readOnlyField },
    { id: 'notes', type: 'textarea', label: t('taxi_fleet.monthlySettlements.notes', 'Notes'), layout: 'full', readOnly },
    { id: 'revenueGross', type: 'text', label: t('taxi_fleet.settlements.revenueGross', 'Revenue gross'), layout: 'half', ...readOnlyField },
    { id: 'revenueNet', type: 'text', label: t('taxi_fleet.settlements.revenueNet', 'Revenue net'), layout: 'half', ...readOnlyField },
    { id: 'costsGross', type: 'text', label: t('taxi_fleet.settlements.costsGross', 'Costs gross'), layout: 'half', ...readOnlyField },
    { id: 'costsNet', type: 'text', label: t('taxi_fleet.settlements.costsNet', 'Costs net'), layout: 'half', ...readOnlyField },
    { id: 'netAmount', type: 'text', label: t('taxi_fleet.settlements.netAmount', 'Net amount'), layout: 'half', ...readOnlyField },
    { id: 'payoutAmount', type: 'text', label: t('taxi_fleet.settlements.payout', 'Payout'), layout: 'half', ...readOnlyField },
    { id: 'totalDistanceKm', type: 'text', label: t('taxi_fleet.settlements.distance.total', 'Total distance (used)'), layout: 'half', ...readOnlyField },
    { id: 'cashExpected', type: 'text', label: t('taxi_fleet.settlements.cashExpected', 'Cash to collect'), layout: 'half', ...readOnlyField },
    { id: 'cashCollected', type: 'text', label: t('taxi_fleet.settlements.cashCollected', 'Cash collected'), layout: 'half', ...readOnlyField },
    { id: 'bonusAmount', type: 'text', label: t('taxi_fleet.settlements.bonusAmount', 'Bonuses'), layout: 'half', ...readOnlyField },
    { id: 'compensationAmount', type: 'text', label: t('taxi_fleet.settlements.compensationAmount', 'Compensations'), layout: 'half', ...readOnlyField },
    { id: 'airportA4Amount', type: 'text', label: t('taxi_fleet.settlements.airportA4Amount', 'Airport + A4'), layout: 'half', ...readOnlyField },
    { id: 'transferAmount', type: 'text', label: t('taxi_fleet.settlements.transferAmount', 'Transfer payout'), layout: 'half', ...readOnlyField },
    {
      id: 'totalAmount',
      type: 'custom',
      label: t('taxi_fleet.settlements.totalAmount', 'Total (transfer + compensations + bonuses)'),
      layout: 'half',
      readOnly: true,
      component: ({ values }) => {
        const total =
          Number(values?.transferAmount ?? 0) +
          Number(values?.compensationAmount ?? 0) +
          Number(values?.bonusAmount ?? 0)
        return <p className="text-lg font-semibold tabular-nums">{formatMoney(total)}</p>
      },
    },
  ]
}

export default function TaxiFleetMonthlySettlementDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const settlementId = params?.id ?? ''
  const { canManageSettlements } = useTaxiFleetPermissions()
  const { resolveName } = useFleetDriverDirectory()
  const [row, setRow] = React.useState<MonthlySettlementRow | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [formKey, setFormKey] = React.useState(0)
  const [isApproving, setIsApproving] = React.useState(false)
  const [isRecalculating, setIsRecalculating] = React.useState(false)

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

  const readOnly = !canManageSettlements || row?.status === 'approved' || row?.status === 'closed'
  const fields = React.useMemo(() => buildMonthlyDetailFields(t, readOnly), [readOnly, t])
  const groups = React.useMemo(() => buildMonthlyDetailGroups(t), [t])

  const title = row
    ? `${t('taxi_fleet.monthlySettlements.detail.title', 'Monthly settlement')} · ${row.monthStart.slice(0, 7)}`
    : t('taxi_fleet.monthlySettlements.detail.title', 'Monthly settlement')

  const initialValues = React.useMemo((): MonthlyFormValues => {
    if (!row) {
      return {
        monthStart: '',
        status: 'draft',
        revenueGross: '0',
        revenueNet: '0',
        costsGross: '0',
        costsNet: '0',
        netAmount: '0',
        payoutAmount: '0',
        totalDistanceKm: '0',
        cashExpected: '0',
        cashCollected: '0',
        bonusAmount: '0',
        compensationAmount: '0',
        airportA4Amount: '0',
        transferAmount: '0',
        totalAmount: '0',
        weeklyCount: '0',
        driverCount: '0',
        notes: '',
      }
    }
    const totalAmount =
      Number(row.transferAmount ?? 0) + Number(row.compensationAmount ?? 0) + Number(row.bonusAmount ?? 0)
    return {
      monthStart: row.monthStart.slice(0, 7),
      status: row.status,
      revenueGross: row.revenueGross ?? '0',
      revenueNet: row.revenueNet ?? '0',
      costsGross: row.costsGross ?? '0',
      costsNet: row.costsNet ?? '0',
      netAmount: row.netAmount ?? '0',
      payoutAmount: row.payoutAmount ?? '0',
      totalDistanceKm: row.totalDistanceKm ?? '0',
      cashExpected: row.cashExpected ?? '0',
      cashCollected: row.cashCollected ?? '0',
      bonusAmount: row.bonusAmount ?? '0',
      compensationAmount: row.compensationAmount ?? '0',
      airportA4Amount: row.airportA4Amount ?? '0',
      transferAmount: row.transferAmount ?? '0',
      totalAmount: String(totalAmount),
      weeklyCount: String(row.weeklyCount ?? 0),
      driverCount: String(row.driverCount ?? 0),
      notes: row.notes ?? '',
    }
  }, [row])

  const revenueBreakdown = React.useMemo(
    () => parseSettlementRevenueBreakdown(row?.snapshotJson) ?? emptySettlementRevenueBreakdown(),
    [row?.snapshotJson],
  )
  const driverBreakdown = React.useMemo(
    () => parseMonthlyDriverBreakdown(row?.snapshotJson),
    [row?.snapshotJson],
  )
  const weeklySettlementIds = React.useMemo(() => {
    const raw = row?.snapshotJson?.weeklySettlementIds
    if (!Array.isArray(raw)) return [] as string[]
    return raw.filter((id): id is string => typeof id === 'string')
  }, [row?.snapshotJson])

  const canApprove = canManageSettlements && row != null && row.status === 'draft'

  const recalculate = async () => {
    if (!row) return
    setIsRecalculating(true)
    try {
      await updateCrud(
        'taxi_fleet/monthly-settlements',
        { id: row.id, recalculateSettlement: true },
        { errorMessage: t('taxi_fleet.monthlySettlements.recalculateError', 'Could not recalculate monthly settlement.') },
      )
      flash(t('taxi_fleet.monthlySettlements.recalculated', 'Monthly settlement recalculated from weekly data.'), 'success')
      setFormKey((value) => value + 1)
      await load()
    } finally {
      setIsRecalculating(false)
    }
  }

  const approveSettlement = async () => {
    if (!row) return
    setIsApproving(true)
    try {
      await updateCrud(
        'taxi_fleet/monthly-settlements',
        { id: row.id, status: 'approved' },
        { errorMessage: t('taxi_fleet.monthlySettlements.form.saveError', 'Could not save monthly settlement.') },
      )
      flash(t('taxi_fleet.monthlySettlements.approved', 'Monthly settlement approved.'), 'success')
      setFormKey((value) => value + 1)
      await load()
    } finally {
      setIsApproving(false)
    }
  }

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
          <ErrorMessage label={error ?? t('taxi_fleet.monthlySettlements.detail.notFound', 'Monthly settlement not found.')} />
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
            href: `${TAXI_FLEET_BASE}/monthly-settlements`,
          },
          { label: title },
        ]}
        title={title}
      />
      <Page>
        <PageBody className="space-y-6">
          <CrudForm<MonthlyFormValues>
            key={formKey}
            title={t('taxi_fleet.monthlySettlements.detail.title', 'Monthly settlement')}
            backHref={`${TAXI_FLEET_BASE}/monthly-settlements`}
            cancelHref={`${TAXI_FLEET_BASE}/monthly-settlements`}
            submitLabel={t('taxi_fleet.settlements.form.save', 'Save changes')}
            fields={fields}
            groups={groups}
            initialValues={initialValues}
            readOnly={readOnly}
            extraActions={
              <>
                {!readOnly ? (
                  <Button type="button" variant="outline" disabled={isRecalculating} onClick={() => void recalculate()}>
                    {t('taxi_fleet.monthlySettlements.recalculate', 'Recalculate from weeklies')}
                  </Button>
                ) : null}
                {canApprove ? (
                  <Button type="button" disabled={isApproving} onClick={() => void approveSettlement()}>
                    {t('taxi_fleet.monthlySettlements.approve', 'Approve')}
                  </Button>
                ) : null}
              </>
            }
            onSubmit={async (values) => {
              await updateCrud(
                'taxi_fleet/monthly-settlements',
                {
                  id: row.id,
                  status: values.status,
                  notes: values.notes.trim() || null,
                },
                { errorMessage: t('taxi_fleet.monthlySettlements.form.saveError', 'Could not save monthly settlement.') },
              )
              flash(t('taxi_fleet.settlements.form.updated', 'Changes saved.'), 'success')
              setFormKey((value) => value + 1)
              await load()
            }}
          />

          <section className="rounded-lg border bg-card p-4">
            <h3 className="text-base font-semibold">
              {t('taxi_fleet.monthlySettlements.typeHint.title', 'Settlement type')}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t(
                'taxi_fleet.monthlySettlements.typeHint.body',
                'Monthly settlement aggregates weekly driver settlements for the calendar month. Weekly settlements remain visible to drivers; monthly reconciliation is operator-only.',
              )}
            </p>
          </section>

          <SettlementRevenueBreakdownPanel
            breakdown={revenueBreakdown}
            revenueGross={row.revenueGross ?? '0'}
            revenueNet={row.revenueNet ?? '0'}
          />
          <SettlementCashSummaryPanel
            cashExpected={row.cashExpected ?? '0'}
            cashCollected={row.cashCollected ?? '0'}
          />
          <MonthlySettlementDriverBreakdownPanel
            driverBreakdown={driverBreakdown}
            resolveDriverName={resolveName}
          />

          {weeklySettlementIds.length > 0 ? (
            <section className="space-y-3 rounded-lg border bg-card p-4">
              <h3 className="text-base font-semibold">
                {t('taxi_fleet.monthlySettlements.linkedWeeklies.title', 'Included weekly settlements')}
              </h3>
              <ul className="space-y-2 text-sm">
                {weeklySettlementIds.map((weeklyId) => (
                  <li key={weeklyId}>
                    <Link
                      href={`${TAXI_FLEET_BASE}/settlements/${encodeURIComponent(weeklyId)}`}
                      className="text-primary hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t('taxi_fleet.monthlySettlements.linkedWeeklies.open', 'Open weekly settlement')} · {weeklyId.slice(0, 8)}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </PageBody>
      </Page>
    </>
  )
}
