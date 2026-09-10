'use client'

import { useT } from '@open-mercato/shared/lib/i18n/context'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { InlineTextEditor } from '@open-mercato/ui/backend/detail'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { computeSettlementCashHandover } from '../lib/settlementPayoutDisplay'

type SettlementCashSummaryPanelProps = {
  cashExpected: string
  cashCollected: string
  embedded?: boolean
  settlementId?: string
  readOnly?: boolean
  crudResource?: string
  onUpdated?: () => Promise<void>
}

function formatMoney(value: string | number): string {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '—'
  return `${parsed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN`
}

export function SettlementCashSummaryPanel({
  cashExpected,
  cashCollected,
  embedded = false,
  settlementId,
  readOnly = true,
  crudResource = 'taxi_fleet/settlements',
  onUpdated,
}: SettlementCashSummaryPanelProps) {
  const t = useT()
  const { cashNotTransferred } = computeSettlementCashHandover({
    cashExpected: Number(cashExpected),
    cashCollected: Number(cashCollected),
  })
  const canEdit = Boolean(settlementId && onUpdated) && !readOnly

  const saveCashCollected = async (next: string | null) => {
    if (!settlementId || !onUpdated) return
    const parsed = Number(String(next ?? '').replace(',', '.'))
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(t('taxi_fleet.settlements.cashSummary.invalidAmount', 'Enter a valid amount.'))
    }
    await updateCrud(
      crudResource,
      { id: settlementId, cashCollected: parsed },
      { errorMessage: t('taxi_fleet.settlements.form.saveError', 'Could not save settlement.') },
    )
    flash(t('taxi_fleet.settlements.form.updated', 'Changes saved.'), 'success')
    await onUpdated()
  }

  const content = (
    <>
      {!embedded ? (
        <h3 className="text-sm font-semibold">
          {t('taxi_fleet.settlements.cashSummary.title', 'Cash summary')}
        </h3>
      ) : null}
      <div className={`grid gap-3 sm:grid-cols-3 ${embedded ? '' : 'mt-0'}`}>
        <div className="rounded border border-border bg-muted/30 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('taxi_fleet.settlements.cashSummary.expected', 'Gotówka z kursów')}
          </p>
          <p className="mt-1 whitespace-nowrap text-lg font-semibold tabular-nums">{formatMoney(cashExpected)}</p>
        </div>
        <div className={canEdit ? 'h-full' : 'rounded border border-border bg-muted/30 p-3'}>
          {canEdit ? (
            <InlineTextEditor
              label={t('taxi_fleet.settlements.cashSummary.transferred', 'Przekazał')}
              value={cashCollected}
              emptyLabel="—"
              inputType="number"
              variant="muted"
              activateOnClick
              showEditTrigger
              validator={(value) => {
                const parsed = Number(value.replace(',', '.'))
                if (!Number.isFinite(parsed) || parsed < 0) {
                  return t('taxi_fleet.settlements.cashSummary.invalidAmount', 'Enter a valid amount.')
                }
                return null
              }}
              onSave={saveCashCollected}
              renderDisplay={({ value }) => (
                <span className="whitespace-nowrap text-lg font-semibold tabular-nums">{formatMoney(value ?? '')}</span>
              )}
            />
          ) : (
            <>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('taxi_fleet.settlements.cashSummary.transferred', 'Przekazał')}
              </p>
              <p className="mt-1 whitespace-nowrap text-lg font-semibold tabular-nums">{formatMoney(cashCollected)}</p>
            </>
          )}
        </div>
        <div className="rounded border border-border bg-muted/30 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('taxi_fleet.settlements.cashSummary.notTransferred', 'Nie przekazał')}
          </p>
          <p className="mt-1 whitespace-nowrap text-lg font-semibold tabular-nums">{formatMoney(cashNotTransferred)}</p>
        </div>
      </div>
    </>
  )

  if (embedded) {
    return <div className="space-y-3">{content}</div>
  }

  return <section className="space-y-3 rounded-lg border bg-card px-4 py-3">{content}</section>
}
