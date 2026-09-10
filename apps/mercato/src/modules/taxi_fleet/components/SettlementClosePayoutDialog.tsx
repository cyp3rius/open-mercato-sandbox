'use client'

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { Label } from '@open-mercato/ui/primitives/label'
import { CRUD_FORM_TEXT_INPUT_CLASS } from '@open-mercato/ui/backend/CrudForm'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import {
  TaxiFleetDialogForm,
  TaxiFleetDialogFrame,
  useTaxiFleetDialogShortcuts,
} from './TaxiFleetDialogShell'
import { computeSettlementPayoutDisplay, formatSettlementMoney } from '../lib/settlementPayoutDisplay'
import {
  computeSettlementClosurePayoutDue,
  computeSettlementFinalBalance,
  isSettlementClosureTypeAvailable,
  suggestSettlementClosureAmount,
  suggestSettlementClosureType,
  type SettlementClosureType,
} from '../lib/settlementClosure'

type SettlementClosePayoutDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  settlementId: string
  payoutAmount: string
  cashExpected: string
  cashCollected: string
  airportA4Amount?: string
  /** CRUD resource path under /api/ — default weekly settlements. */
  crudResource?: string
  /** Monthly: close as full transfer payout only (no cash return path). */
  transferOnlyPayout?: boolean
  onSaved: () => Promise<void>
}

function formatSuggested(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return value.toFixed(2)
}

export function SettlementClosePayoutDialog({
  open,
  onOpenChange,
  settlementId,
  payoutAmount,
  cashExpected,
  cashCollected,
  airportA4Amount = '0',
  crudResource = 'taxi_fleet/settlements',
  transferOnlyPayout = false,
  onSaved,
}: SettlementClosePayoutDialogProps) {
  const t = useT()
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [closureType, setClosureType] = React.useState<SettlementClosureType>('payout')
  const [closureAmount, setClosureAmount] = React.useState('0')
  const [isSaving, setIsSaving] = React.useState(false)

  const payoutDisplay = React.useMemo(() => {
    if (transferOnlyPayout) {
      const payout = Math.max(0, Number(payoutAmount ?? 0))
      return {
        cashPayout: 0,
        transferPayout: payout > 0.005 ? payout : null,
        driverReturnDue: null,
      }
    }
    return computeSettlementPayoutDisplay({
      payoutAmount: Number(payoutAmount ?? 0),
      cashExpected: Number(cashExpected ?? 0),
      cashCollected: Number(cashCollected ?? 0),
      airportA4Amount: Number(airportA4Amount ?? 0),
    })
  }, [airportA4Amount, cashCollected, cashExpected, payoutAmount, transferOnlyPayout])

  const payoutAvailable = isSettlementClosureTypeAvailable('payout', payoutDisplay)
  const returnAvailable = isSettlementClosureTypeAvailable('cash_return', payoutDisplay)

  React.useEffect(() => {
    if (!open) return
    const suggestedType = suggestSettlementClosureType(payoutDisplay)
    const resolvedType =
      suggestedType === 'payout' && !payoutAvailable && returnAvailable
        ? 'cash_return'
        : suggestedType === 'cash_return' && !returnAvailable && payoutAvailable
          ? 'payout'
          : suggestedType
    setClosureType(resolvedType)
    setClosureAmount(formatSuggested(suggestSettlementClosureAmount(resolvedType, payoutDisplay)))
  }, [open, payoutAvailable, payoutDisplay, returnAvailable])

  React.useEffect(() => {
    if (!open) return
    setClosureAmount(formatSuggested(suggestSettlementClosureAmount(closureType, payoutDisplay)))
  }, [closureType, open, payoutDisplay])

  const previewBalance = React.useMemo(
    () =>
      computeSettlementFinalBalance({
        payoutDisplay,
        closure: {
          type: closureType,
          amount: Number(closureAmount),
        },
      }),
    [closureAmount, closureType, payoutDisplay],
  )

  const handleCancel = React.useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const handleSave = React.useCallback(async () => {
    const parsedAmount = Number(String(closureAmount).replace(',', '.'))
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      flash(t('taxi_fleet.settlements.close.invalidAmount', 'Enter a valid amount.'), 'error')
      return
    }
    if (closureType === 'payout' && !payoutAvailable && parsedAmount > 0.005) {
      flash(t('taxi_fleet.settlements.close.payoutUnavailable', 'No payout is due for this settlement.'), 'error')
      return
    }
    if (closureType === 'cash_return' && !returnAvailable && parsedAmount > 0.005) {
      flash(t('taxi_fleet.settlements.close.returnUnavailable', 'No cash return is due for this settlement.'), 'error')
      return
    }

    setIsSaving(true)
    try {
      await updateCrud(
        crudResource,
        {
          id: settlementId,
          status: 'paid',
          closureType,
          closureAmount: parsedAmount,
        },
        { errorMessage: t('taxi_fleet.settlements.form.saveError', 'Could not save settlement.') },
      )
      flash(t('taxi_fleet.settlements.closedPaid', 'Settlement marked as paid.'), 'success')
      await onSaved()
      onOpenChange(false)
    } finally {
      setIsSaving(false)
    }
  }, [closureAmount, closureType, crudResource, onOpenChange, onSaved, payoutAvailable, returnAvailable, settlementId, t])

  const handleDialogKeyDown = useTaxiFleetDialogShortcuts({
    contentRef,
    onCancel: handleCancel,
    canSubmit: !isSaving,
  })

  const optionClass = (active: boolean, disabled = false) =>
    `flex items-start gap-3 rounded-md border p-3 transition-colors ${
      disabled
        ? 'cursor-not-allowed border-border opacity-50'
        : active
          ? 'cursor-pointer border-primary bg-primary/5'
          : 'cursor-pointer border-border hover:bg-muted/30'
    }`

  return (
    <TaxiFleetDialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title={t('taxi_fleet.settlements.close.title', 'Close / Payout')}
      size="md"
      contentRef={contentRef}
      onKeyDown={handleDialogKeyDown}
    >
      <TaxiFleetDialogForm
        onSubmit={(event) => {
          event.preventDefault()
          void handleSave()
        }}
        body={
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {transferOnlyPayout
                ? t(
                    'taxi_fleet.monthlySettlements.close.hint',
                    'Record the bank transfer payout to the driver. Saving closes the monthly settlement.',
                  )
                : t(
                    'taxi_fleet.settlements.close.hint',
                    'Record the payout to the driver or the cash return received. Saving closes the settlement.',
                  )}
            </p>

            <div className={`grid gap-3 ${transferOnlyPayout ? '' : 'sm:grid-cols-2'}`}>
              <label
                className={optionClass(closureType === 'payout', !payoutAvailable || isSaving)}
                htmlFor="settlement-close-type-payout"
              >
                <input
                  id="settlement-close-type-payout"
                  type="radio"
                  name="settlement-close-type"
                  className="mt-1"
                  checked={closureType === 'payout'}
                  disabled={!payoutAvailable || isSaving}
                  onChange={() => setClosureType('payout')}
                />
                <span className="space-y-1">
                  <span className="block text-sm font-medium">
                    {t('taxi_fleet.settlements.close.typePayout', 'Payout')}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t('taxi_fleet.settlements.close.expectedPayout', 'Expected: {amount}', {
                      amount: formatSettlementMoney(computeSettlementClosurePayoutDue(payoutDisplay)),
                    })}
                  </span>
                </span>
              </label>

              {!transferOnlyPayout ? (
              <label
                className={optionClass(closureType === 'cash_return', !returnAvailable || isSaving)}
                htmlFor="settlement-close-type-return"
              >
                <input
                  id="settlement-close-type-return"
                  type="radio"
                  name="settlement-close-type"
                  className="mt-1"
                  checked={closureType === 'cash_return'}
                  disabled={!returnAvailable || isSaving}
                  onChange={() => setClosureType('cash_return')}
                />
                <span className="space-y-1">
                  <span className="block text-sm font-medium">
                    {t('taxi_fleet.settlements.close.typeCashReturn', 'Return to cash register')}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t('taxi_fleet.settlements.close.expectedReturn', 'Expected: {amount}', {
                      amount: formatSettlementMoney(payoutDisplay.driverReturnDue ?? 0),
                    })}
                  </span>
                </span>
              </label>
              ) : null}
            </div>

            <div className="space-y-1">
              <Label htmlFor="settlement-close-amount" className="block text-sm font-medium">
                {closureType === 'payout'
                  ? t('taxi_fleet.settlements.close.amountPayout', 'Payout amount')
                  : t('taxi_fleet.settlements.close.amountReturn', 'Return amount')}
              </Label>
              <input
                id="settlement-close-amount"
                type="number"
                min={0}
                step={0.01}
                value={closureAmount}
                onChange={(event) => setClosureAmount(event.target.value)}
                className={CRUD_FORM_TEXT_INPUT_CLASS}
                disabled={isSaving}
              />
            </div>

            <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
              <p className="font-medium">{t('taxi_fleet.settlements.close.previewBalance', 'Final balance preview')}</p>
              <p className="mt-1 tabular-nums">{formatSettlementMoney(previewBalance.finalBalance)}</p>
              {!previewBalance.isBalanced ? (
                <p className="mt-1 text-xs text-amber-700">
                  {previewBalance.remainingPayout > 0.005
                    ? t('taxi_fleet.settlements.close.previewPayoutRemaining', 'Payout still due: {amount}', {
                        amount: formatSettlementMoney(previewBalance.remainingPayout),
                      })
                    : null}
                  {previewBalance.remainingReturn > 0.005
                    ? t('taxi_fleet.settlements.close.previewReturnRemaining', 'Return still due: {amount}', {
                        amount: formatSettlementMoney(previewBalance.remainingReturn),
                      })
                    : null}
                </p>
              ) : (
                <p className="mt-1 text-xs text-emerald-700">
                  {t('taxi_fleet.settlements.close.previewBalanced', 'Balanced — final state will be 0.00.')}
                </p>
              )}
            </div>
          </div>
        }
        footer={
          <>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isSaving}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {t('common.save', 'Save')}
            </Button>
          </>
        }
      />
    </TaxiFleetDialogFrame>
  )
}
