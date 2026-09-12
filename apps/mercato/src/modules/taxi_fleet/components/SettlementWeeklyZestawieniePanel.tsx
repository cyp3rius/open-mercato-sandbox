'use client'

import { PenLine } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { computeSettlementPreviewNetAmount } from '../lib/settlementCompanyProfit'
import {
  computeSettlementFinalBalance,
  parseSettlementClosureRecord,
  type SettlementClosureType,
} from '../lib/settlementClosure'
import { computeSettlementPayoutDisplay, formatSettlementMoney } from '../lib/settlementPayoutDisplay'
import { SettlementIndicatorLedValue } from './SettlementIndicatorLedValue'
import { SettlementReturnDueValue } from './SettlementReturnDueValue'

type SettlementWeeklyZestawieniePanelProps = {
  revenueNet: string
  costsNet: string
  netAmount: string
  payoutAmount: string
  compensationAmount: string
  bonusAmount: string
  cashExpected: string
  cashCollected: string
  airportA4Amount?: string
  status?: string
  closureType?: SettlementClosureType | string | null
  closureAmount?: string | null
  readOnly?: boolean
  /** Monthly payout: bank transfer only (no cash payout / return-due rows). */
  transferOnlyPayout?: boolean
  onOpenAdjustments?: () => void
}

function formatMoney(value: string | number): string {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '—'
  return `${parsed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN`
}

function SummaryRow({
  label,
  value,
  valueNode,
  hint,
  emphasized = false,
  valueClassName,
}: {
  label: string
  value?: string
  valueNode?: React.ReactNode
  hint?: string
  emphasized?: boolean
  valueClassName?: string
}) {
  return (
    <tr className={emphasized ? 'bg-muted/30' : undefined}>
      <td className="px-3 py-2">
        <div className="text-muted-foreground">{label}</div>
        {hint ? <div className="text-xs text-muted-foreground/80">{hint}</div> : null}
      </td>
      <td
        className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${emphasized ? 'font-semibold' : 'font-medium'} ${valueClassName ?? ''}`}
      >
        {valueNode ?? value}
      </td>
    </tr>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <tr className="border-t bg-muted/20">
      <td colSpan={2} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </td>
    </tr>
  )
}

export function SettlementWeeklyZestawieniePanel({
  revenueNet,
  costsNet,
  netAmount,
  payoutAmount,
  compensationAmount,
  bonusAmount,
  cashExpected,
  cashCollected,
  airportA4Amount = '0',
  status,
  closureType = null,
  closureAmount = null,
  readOnly = false,
  transferOnlyPayout = false,
  onOpenAdjustments,
}: SettlementWeeklyZestawieniePanelProps) {
  const t = useT()

  const parsedNetAmount = Number(netAmount ?? 0)
  const parsedCompensation = Number(compensationAmount ?? 0)
  const parsedBonus = Number(bonusAmount ?? 0)
  const parsedPayout = Number(payoutAmount ?? 0)

  const previewNetAmount = computeSettlementPreviewNetAmount({
    netAmount: parsedNetAmount,
    compensationAmount: parsedCompensation,
    bonusAmount: parsedBonus,
  })

  const payoutDisplay = transferOnlyPayout
    ? {
        cashPayout: 0,
        transferPayout: Math.max(0, parsedPayout) > 0.005 ? Math.max(0, parsedPayout) : null,
        driverReturnDue: null,
      }
    : computeSettlementPayoutDisplay({
        payoutAmount: parsedPayout,
        cashExpected: Number(cashExpected ?? 0),
        cashCollected: Number(cashCollected ?? 0),
        airportA4Amount: Number(airportA4Amount ?? 0),
      })

  const closure = parseSettlementClosureRecord(
    status === 'paid' ? { closureType, closureAmount } : null,
  )
  const finalBalance = computeSettlementFinalBalance({ payoutDisplay, closure })

  return (
    <section className="space-y-3 rounded-lg border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{t('taxi_fleet.settlements.zestawienie.title', 'Zestawienie')}</h3>
        {onOpenAdjustments && !readOnly ? (
          <Button type="button" variant="outline" size="sm" onClick={onOpenAdjustments}>
            <PenLine className="mr-2 size-4 shrink-0" aria-hidden />
            {t('taxi_fleet.settlements.adjustments.makeCorrection', 'Make correction')}
          </Button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full text-sm">
          <tbody>
            <SectionHeader title={t('taxi_fleet.settlements.zestawienie.sections.base', 'Podstawa')} />
            <SummaryRow
              label={t('taxi_fleet.settlements.zestawienie.revenueNet', 'Przychód')}
              value={formatMoney(revenueNet)}
            />
            <SummaryRow
              label={t('taxi_fleet.settlements.zestawienie.costsNet', 'Koszty')}
              value={formatMoney(costsNet)}
            />
            <SummaryRow
              label={t('taxi_fleet.settlements.zestawienie.netAmount', 'Zysk netto')}
              value={formatMoney(netAmount)}
              emphasized
            />

            <SectionHeader
              title={t('taxi_fleet.settlements.zestawienie.sections.adjustments', 'Kompensaty i bonusy')}
            />
            <SummaryRow
              label={t('taxi_fleet.settlements.zestawienie.compensation', 'Kompensaty')}
              value={formatMoney(compensationAmount)}
            />
            <SummaryRow
              label={t('taxi_fleet.settlements.zestawienie.bonus', 'Bonusy')}
              value={formatMoney(bonusAmount)}
            />
            <SummaryRow
              label={t('taxi_fleet.settlements.zestawienie.previewNetAmount', 'Zysk netto')}
              hint={t(
                'taxi_fleet.settlements.zestawienie.previewNetAmountHint',
                '− kompensaty, − bonusy',
              )}
              value={formatMoney(previewNetAmount)}
              emphasized
            />

            <SectionHeader title={t('taxi_fleet.settlements.zestawienie.sections.payout', 'Wypłata kierowcy')} />
            <SummaryRow
              label={t('taxi_fleet.settlements.zestawienie.driverPayout', 'Wynagrodzenie kierowcy')}
              value={formatMoney(payoutAmount)}
              emphasized
            />
            {!transferOnlyPayout ? (
              <>
                <SummaryRow
                  label={t('taxi_fleet.settlements.list.cashPayout', 'Wypłata (gotówka)')}
                  value={formatMoney(payoutDisplay.cashPayout)}
                />
                <SummaryRow
                  label={t('taxi_fleet.settlements.list.transferPayout', 'Wypłata (przelew)')}
                  value={
                    payoutDisplay.transferPayout != null
                      ? formatMoney(payoutDisplay.transferPayout)
                      : formatMoney(0)
                  }
                />
                <SummaryRow
                  label={t('taxi_fleet.settlements.list.driverReturnDue', 'Do zwrotu przez kierowcę (gotówka)')}
                  valueNode={
                    <SettlementReturnDueValue amount={payoutDisplay.driverReturnDue ?? 0} align="right" />
                  }
                />
              </>
            ) : null}

            {closure ? (
              <>
                <SectionHeader title={t('taxi_fleet.settlements.zestawienie.sections.closure', 'Zamknięcie')} />
                <SummaryRow
                  label={
                    closure.type === 'payout'
                      ? t('taxi_fleet.settlements.close.recordedPayout', 'Wypłata')
                      : t('taxi_fleet.settlements.close.recordedReturn', 'Zwrot do kasy')
                  }
                  value={formatSettlementMoney(closure.amount)}
                  emphasized
                />
                <SummaryRow
                  label={t('taxi_fleet.settlements.close.finalBalance', 'Stan końcowy')}
                  hint={
                    finalBalance.isBalanced
                      ? t('taxi_fleet.settlements.close.finalBalanceBalanced', 'Rozliczenie wyrównane.')
                      : finalBalance.remainingPayout > 0.005
                        ? t('taxi_fleet.settlements.close.finalBalancePayoutDue', 'Pozostała wypłata do kierowcy.')
                        : t('taxi_fleet.settlements.close.finalBalanceReturnDue', 'Pozostały zwrot od kierowcy.')
                  }
                  valueNode={
                    <div className="flex justify-end">
                      <SettlementIndicatorLedValue
                        value={formatSettlementMoney(finalBalance.finalBalance)}
                        tone={finalBalance.isBalanced ? 'green' : 'red'}
                      />
                    </div>
                  }
                  emphasized
                />
              </>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
