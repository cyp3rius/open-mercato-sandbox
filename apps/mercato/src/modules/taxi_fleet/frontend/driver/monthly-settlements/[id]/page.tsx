'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { formatMoneyDisplay } from '@open-mercato/shared/lib/numeric'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { DriverShell } from '../../../../components/driverApp/DriverShell'
import {
  driverBadgeNeutralClass,
  driverCardClass,
  driverMutedTextClass,
  driverSecondaryActionClass,
  driverSectionTitleClass,
} from '../../../../components/driverApp/driverUi'
import type { DriverMonthlySettlementDetail } from '../../../../lib/driverSettlements'

function statusLabel(t: (key: string, fallback?: string) => string, status: string): string {
  const key = `taxi_fleet.settlements.statuses.${status}`
  const fallback =
    status === 'approved' ? 'Approved' : status === 'paid' ? 'Paid' : status
  return t(key, fallback)
}

function SummaryRow({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 border-b border-[#F1F1F4] py-2.5 last:border-b-0 ${emphasized ? 'pt-3' : ''}`}
    >
      <span className={emphasized ? 'font-medium text-[#071437]' : driverMutedTextClass}>{label}</span>
      <span
        className={`tabular-nums ${emphasized ? 'text-base font-semibold text-[#071437]' : 'font-medium text-[#071437]'}`}
      >
        {value}
      </span>
    </div>
  )
}

export default function DriverMonthlySettlementDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const settlementId = params?.id ?? ''
  const [row, setRow] = React.useState<DriverMonthlySettlementDetail | null>(null)
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    let active = true
    void (async () => {
      if (!settlementId) {
        setLoaded(true)
        return
      }
      try {
        const call = await apiCall<DriverMonthlySettlementDetail>(
          `/api/taxi_fleet/driver/monthly-settlements/${encodeURIComponent(settlementId)}`,
        )
        if (!active) return
        if (!call.ok) {
          if (call.status === 401 || call.status === 403) {
            window.location.href = '/driver/login'
            return
          }
          throw new Error('load_failed')
        }
        setRow(call.result ?? null)
      } catch {
        if (!active) return
        flash(
          t('taxi_fleet.driverApp.settlements.detailLoadFailed', 'Could not load settlement.'),
          'error',
        )
        setRow(null)
      } finally {
        if (active) setLoaded(true)
      }
    })()
    return () => {
      active = false
    }
  }, [settlementId, t])

  return (
    <DriverShell title={t('taxi_fleet.driverApp.settlements.monthlyDetailTitle', 'Monthly payout')}>
      <div className="space-y-4">
        <Link href="/driver/settlements" className={`${driverSecondaryActionClass} w-fit gap-2`}>
          <ArrowLeft className="size-4" aria-hidden />
          {t('taxi_fleet.driverApp.settlements.backToList', 'Back to settlements')}
        </Link>

        {!loaded ? (
          <p className={driverMutedTextClass}>{t('taxi_fleet.driverApp.settlements.loading', 'Loading…')}</p>
        ) : !row ? (
          <p className={driverMutedTextClass}>
            {t('taxi_fleet.driverApp.settlements.notFound', 'Settlement not found.')}
          </p>
        ) : (
          <>
            <div className={driverCardClass}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className={driverSectionTitleClass}>{row.monthStart.slice(0, 7)}</div>
                  <div className="mt-2">
                    <span className={driverBadgeNeutralClass}>{statusLabel(t, row.status)}</span>
                  </div>
                  <p className={`mt-2 text-sm ${driverMutedTextClass}`}>
                    {t(
                      'taxi_fleet.driverApp.settlements.monthlyPayoutHint',
                      'This is your monthly payout settlement.',
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <div className={`text-xs ${driverMutedTextClass}`}>
                    {t('taxi_fleet.driverApp.settlements.payout', 'Payout')}
                  </div>
                  <div className="text-xl font-semibold tabular-nums text-[#071437]">
                    {formatMoneyDisplay(row.payoutAmount)}
                  </div>
                </div>
              </div>
            </div>

            <div className={driverCardClass}>
              <h2 className={driverSectionTitleClass}>
                {t('taxi_fleet.driverApp.settlements.summary', 'Summary')}
              </h2>
              <div className="mt-1">
                <SummaryRow
                  label={t('taxi_fleet.driverApp.settlements.revenue', 'Revenue')}
                  value={formatMoneyDisplay(row.revenueNet)}
                />
                <SummaryRow
                  label={t('taxi_fleet.driverApp.settlements.costs', 'Costs')}
                  value={formatMoneyDisplay(row.costsNet)}
                />
                <SummaryRow
                  label={t('taxi_fleet.driverApp.settlements.net', 'Net')}
                  value={formatMoneyDisplay(row.netAmount)}
                />
                <SummaryRow
                  label={t('taxi_fleet.driverApp.settlements.finalPayout', 'Final payout')}
                  value={formatMoneyDisplay(row.payoutAmount)}
                  emphasized
                />
              </div>
            </div>
          </>
        )}
      </div>
    </DriverShell>
  )
}
