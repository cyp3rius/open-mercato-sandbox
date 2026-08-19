'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { parseNumericValue, sanitizePercentTypingInput } from '@open-mercato/shared/lib/numeric'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'
import { DriverCostTypePicker } from '../../../../components/driverApp/DriverCostTypePicker'
import { DriverVatRatePicker } from '../../../../components/driverApp/DriverVatRatePicker'
import { DriverReceiptFields } from '../../../../components/driverApp/DriverReceiptFields'
import { DriverShell } from '../../../../components/driverApp/DriverShell'
import {
  driverFieldClass,
  driverLabelClass,
  driverPrimaryActionClass,
  driverSectionDescClass,
  driverSectionTitleClass,
} from '../../../../components/driverApp/driverUi'
import { type TaxiFleetCostType } from '../../../../lib/costTypes'
import { DEFAULT_EXPENSE_VAT_RATE_PERCENT, type ExpenseVatRatePercent } from '../../../../lib/expenseVat'
import {
  appendPendingExpenseToCache,
  enqueueDriverMutation,
} from '../../../../lib/driverOffline/outbox'
import { fileToBase64 } from '../../../../lib/driverOffline/buildTripPayload'
import { newClientId, saveReceiptBlob } from '../../../../lib/driverOffline/tripDrafts'

type CostType = TaxiFleetCostType

function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromDateTimeLocalValue(value: string): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export default function DriverExpenseCreatePage() {
  const t = useT()
  const router = useRouter()
  const [costType, setCostType] = React.useState<CostType>('fuel')
  const [vatRatePercent, setVatRatePercent] = React.useState<ExpenseVatRatePercent>(DEFAULT_EXPENSE_VAT_RATE_PERCENT)
  const [amount, setAmount] = React.useState('')
  const [occurredAtLocal, setOccurredAtLocal] = React.useState(() => toDateTimeLocalValue(new Date()))
  const [notes, setNotes] = React.useState('')
  const [documentNumber, setDocumentNumber] = React.useState('')
  const [receiptAttachmentId, setReceiptAttachmentId] = React.useState<string | null>(null)
  const [receiptAttachmentName, setReceiptAttachmentName] = React.useState<string | null>(null)
  const [receiptBlobId, setReceiptBlobId] = React.useState<string | null>(null)
  const [receiptDraftRecordId] = React.useState(newClientId)
  const [busy, setBusy] = React.useState(false)

  async function submit() {
    const parsedAmount = parseNumericValue(amount)
    if (parsedAmount === null || parsedAmount <= 0) {
      flash(t('taxi_fleet.driverApp.expenses.amountRequired', 'Enter a cost amount.'), 'error')
      return
    }
    const occurredAt = fromDateTimeLocalValue(occurredAtLocal)
    if (!occurredAt) {
      flash(t('taxi_fleet.driverApp.expenses.occurredAtInvalid', 'Enter a valid date and time.'), 'error')
      return
    }

    const payload = {
      costType,
      vatRatePercent,
      amount: parsedAmount,
      currencyCode: 'PLN',
      documentNumber: documentNumber.trim() || null,
      occurredAt: occurredAt.toISOString(),
      notes: notes.trim() || null,
      receiptAttachmentId,
      receiptBlobId,
    }

    setBusy(true)
    try {
      if (!navigator.onLine) {
        await enqueueDriverMutation({ type: 'expense.create', payload })
        await appendPendingExpenseToCache({
          id: `pending:${receiptDraftRecordId}`,
          kind: 'expense',
          costType,
          amount: parsedAmount.toFixed(2),
          vatRatePercent: String(vatRatePercent),
          currencyCode: 'PLN',
          documentNumber: documentNumber.trim() || null,
          occurredAt: occurredAt.toISOString(),
          notes: notes.trim() || null,
          tripId: null,
          receiptAttachmentId,
          pending: true,
        })
        flash(t('taxi_fleet.driverApp.expenses.queued', 'Cost saved offline. It will sync when you are online.'), 'success')
        router.push('/driver/expenses')
        return
      }

      const call = await apiCall<{ id?: string | null }>('/api/taxi_fleet/driver/expenses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          costType,
          vatRatePercent,
          amount: parsedAmount,
          currencyCode: 'PLN',
          documentNumber: documentNumber.trim() || null,
          occurredAt: occurredAt.toISOString(),
          notes: notes.trim() || null,
          receiptAttachmentId,
        }),
      })
      if (!call.ok) {
        throw new Error('save failed')
      }
      flash(t('taxi_fleet.driverApp.expenses.saved', 'Cost registered.'), 'success')
      router.push('/driver/expenses')
    } catch {
      flash(t('taxi_fleet.driverApp.expenses.saveFailed', 'Could not save the cost.'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DriverShell title={t('taxi_fleet.driverApp.expenses.new', 'Register a cost')}>
      <div className="space-y-5">
        <div>
          <div className={driverSectionTitleClass}>
            {t('taxi_fleet.driverApp.expenses.formTitle', 'Cost details')}
          </div>
          <p className={driverSectionDescClass}>
            {t(
              'taxi_fleet.driverApp.expenses.hint',
              'Fuel and other costs are included in the weekly settlement. Amount is gross; VAT defaults to 23%.',
            )}
          </p>
        </div>

        <DriverCostTypePicker value={costType} disabled={busy} onChange={setCostType} />

        <DriverVatRatePicker value={vatRatePercent} disabled={busy} onChange={setVatRatePercent} />

        <div>
          <label htmlFor="expenseAmount" className={driverLabelClass}>
            {t('taxi_fleet.driverApp.expenses.amount', 'Amount')}
          </label>
          <div className="flex min-w-0 items-stretch">
            <input
              id="expenseAmount"
              type="text"
              inputMode="decimal"
              disabled={busy}
              value={amount}
              onChange={(event) => setAmount(sanitizePercentTypingInput(event.target.value, 2))}
              onBlur={() => {
                const parsed = parseNumericValue(amount)
                setAmount(parsed === null || parsed < 0 ? '' : parsed.toFixed(2))
              }}
              placeholder="0.00"
              className={`${driverFieldClass} min-w-0 flex-1 rounded-r-none tabular-nums`}
              autoComplete="off"
            />
            <div className="flex min-h-11 shrink-0 items-center rounded-r-md border border-l-0 border-[#DBDFE9] bg-[#F9F9F9] px-3 text-sm font-semibold text-[#78829D]">
              PLN
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="expenseOccurredAt" className={driverLabelClass}>
            {t('taxi_fleet.driverApp.expenses.occurredAt', 'When')}
          </label>
          <input
            id="expenseOccurredAt"
            type="datetime-local"
            disabled={busy}
            value={occurredAtLocal}
            onChange={(event) => setOccurredAtLocal(event.target.value)}
            className={driverFieldClass}
          />
        </div>

        <DriverReceiptFields
          documentNumber={documentNumber}
          attachmentId={receiptAttachmentId}
          attachmentName={receiptAttachmentName}
          draftRecordId={receiptDraftRecordId}
          disabled={busy}
          onDocumentNumberChange={setDocumentNumber}
          onAttachmentChange={(next) => {
            setReceiptAttachmentId(next.id)
            setReceiptAttachmentName(next.fileName)
            if (!next.id) setReceiptBlobId(null)
          }}
          onOfflineFile={async (file) => {
            const dataBase64 = await fileToBase64(file)
            const row = await saveReceiptBlob({
              draftRecordId: receiptDraftRecordId,
              fileName: file.name || 'receipt.jpg',
              mime: file.type || 'image/jpeg',
              dataBase64,
            })
            return { blobId: row.id, fileName: row.fileName }
          }}
          onOfflineStored={(next) => {
            setReceiptBlobId(next.blobId)
            setReceiptAttachmentId(null)
            setReceiptAttachmentName(next.fileName)
          }}
        />

        <div>
          <label htmlFor="expenseNotes" className={driverLabelClass}>
            {t('taxi_fleet.driverApp.expenses.notes', 'Notes')}
          </label>
          <textarea
            id="expenseNotes"
            disabled={busy}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className={`${driverFieldClass} min-h-24 py-2`}
          />
        </div>

        <Button type="button" className={driverPrimaryActionClass} disabled={busy} onClick={() => void submit()}>
          {busy
            ? t('taxi_fleet.driverApp.expenses.submitting', 'Saving…')
            : t('taxi_fleet.driverApp.expenses.submit', 'Save cost')}
        </Button>
      </div>
    </DriverShell>
  )
}
