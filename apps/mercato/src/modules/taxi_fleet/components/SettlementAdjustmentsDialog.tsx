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
import type { SettlementFormValues } from './settlementFormConfig'

type SettlementAdjustmentsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  settlementId: string
  initialValues: SettlementFormValues
  readOnly: boolean
  onSaved: () => Promise<void>
}

export function SettlementAdjustmentsDialog({
  open,
  onOpenChange,
  settlementId,
  initialValues,
  readOnly,
  onSaved,
}: SettlementAdjustmentsDialogProps) {
  const t = useT()
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [compensationAmount, setCompensationAmount] = React.useState('0')
  const [bonusAmount, setBonusAmount] = React.useState('0')
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setCompensationAmount(initialValues.compensationAmount ?? '0')
    setBonusAmount(initialValues.bonusAmount ?? '0')
  }, [open, initialValues.bonusAmount, initialValues.compensationAmount])

  const handleCancel = React.useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const handleSave = React.useCallback(async () => {
    const parsedCompensation = Number(compensationAmount)
    const parsedBonus = Number(bonusAmount)
    if (!Number.isFinite(parsedCompensation) || parsedCompensation < 0) {
      flash(t('taxi_fleet.settlements.adjustments.invalidCompensation', 'Enter a valid compensation amount.'), 'error')
      return
    }
    if (!Number.isFinite(parsedBonus) || parsedBonus < 0) {
      flash(t('taxi_fleet.settlements.adjustments.invalidBonus', 'Enter a valid bonus amount.'), 'error')
      return
    }

    setIsSaving(true)
    try {
      await updateCrud(
        'taxi_fleet/settlements',
        {
          id: settlementId,
          bonusAmount: parsedBonus,
          compensationAmount: parsedCompensation,
        },
        { errorMessage: t('taxi_fleet.settlements.form.saveError', 'Could not save settlement.') },
      )
      flash(t('taxi_fleet.settlements.form.updated', 'Changes saved.'), 'success')
      await onSaved()
      onOpenChange(false)
    } finally {
      setIsSaving(false)
    }
  }, [bonusAmount, compensationAmount, onOpenChange, onSaved, settlementId, t])

  const handleDialogKeyDown = useTaxiFleetDialogShortcuts({
    contentRef,
    onCancel: handleCancel,
    canSubmit: !readOnly && !isSaving,
  })

  return (
    <TaxiFleetDialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title={t('taxi_fleet.settlements.adjustments.title', 'Corrections')}
      size="md"
      contentRef={contentRef}
      onKeyDown={handleDialogKeyDown}
    >
      <TaxiFleetDialogForm
        onSubmit={(event) => {
          event.preventDefault()
          if (readOnly) {
            handleCancel()
            return
          }
          void handleSave()
        }}
        body={
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="settlement-compensation-amount" className="block text-sm font-medium">
                {t('taxi_fleet.settlements.compensationAmount', 'Compensations')}
              </Label>
              <input
                id="settlement-compensation-amount"
                type="number"
                min={0}
                step={0.01}
                value={compensationAmount}
                onChange={(event) => setCompensationAmount(event.target.value)}
                className={CRUD_FORM_TEXT_INPUT_CLASS}
                disabled={readOnly || isSaving}
                readOnly={readOnly}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="settlement-bonus-amount" className="block text-sm font-medium">
                {t('taxi_fleet.settlements.bonusAmount', 'Bonuses')}
              </Label>
              <input
                id="settlement-bonus-amount"
                type="number"
                min={0}
                step={0.01}
                value={bonusAmount}
                onChange={(event) => setBonusAmount(event.target.value)}
                className={CRUD_FORM_TEXT_INPUT_CLASS}
                disabled={readOnly || isSaving}
                readOnly={readOnly}
              />
            </div>
          </div>
        }
        footer={
          readOnly ? (
            <Button type="button" variant="outline" onClick={handleCancel}>
              {t('common.close', 'Close')}
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={handleCancel} disabled={isSaving}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {t('common.save', 'Save')}
              </Button>
            </>
          )
        }
      />
    </TaxiFleetDialogFrame>
  )
}
