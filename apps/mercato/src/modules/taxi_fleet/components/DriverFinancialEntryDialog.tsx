"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { CRUD_FORM_TEXT_INPUT_CLASS } from '@open-mercato/ui/backend/CrudForm'
import { LookupSelect, type LookupSelectItem } from '@open-mercato/ui/backend/inputs/LookupSelect'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { createCrud, updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { parseNumericValue } from '@open-mercato/shared/lib/numeric'
import { TripCustomerField } from './TripCustomerField'
import { useTaxiFleetLabels } from './useTaxiFleetLabels'
import { isoToDateOnlyValue, parseDateOnlyValue } from '../lib/datetimeLocal'
import { readTripCustomerEntityId } from '../lib/customerLink'
import {
  DateInputField,
  FinancialAttachmentField,
  FormFieldLabel,
  MoneyInputField,
  NotesInputField,
  SelectInputField,
} from './financial/FinancialFormPrimitives'
import {
  TaxiFleetDialogForm,
  TaxiFleetDialogFrame,
  useTaxiFleetDialogShortcuts,
} from './TaxiFleetDialogShell'

export const TAXI_FLEET_COST_TYPES = ['fuel', 'toll', 'parking', 'maintenance', 'other'] as const
export const TAXI_FLEET_INCOME_DOCUMENT_TYPES = ['receipt', 'invoice'] as const

export type FinancialEntryRow = {
  id: string
  kind: 'income' | 'expense'
  incomeDocumentType?: 'receipt' | 'invoice' | null
  costType?: string | null
  tripId?: string | null
  customerPersonId?: string | null
  customerCompanyId?: string | null
  amount: string
  currencyCode: string
  documentNumber?: string | null
  occurredAt?: string | null
  receiptAttachmentId?: string | null
  notes?: string | null
}

type DriverFinancialEntryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamMemberId: string
  mode: 'income' | 'expense'
  entry?: FinancialEntryRow | null
  onSaved: () => void
}

type TripListItem = {
  id?: string
  startedAt?: string | null
  tripType?: string
}

type TripDetail = {
  id?: string
  customerPersonId?: string | null
  customerCompanyId?: string | null
  revenueAmount?: string | null
  startedAt?: string | null
  endedAt?: string | null
  notes?: string | null
}

async function fetchDriverTripOptions(teamMemberId: string, query?: string): Promise<LookupSelectItem[]> {
  const params = new URLSearchParams({
    page: '1',
    pageSize: '50',
    teamMemberId,
    sortField: 'startedAt',
    sortDir: 'desc',
  })
  const call = await apiCall<{ items: TripListItem[] }>(`/api/taxi_fleet/trips?${params}`)
  const items = Array.isArray(call.result?.items) ? call.result.items : []
  return items
    .map((item) => {
      const id = typeof item.id === 'string' ? item.id : null
      if (!id) return null
      const started = item.startedAt ? item.startedAt.slice(0, 16).replace('T', ' ') : id.slice(0, 8)
      const type = typeof item.tripType === 'string' ? item.tripType : 'trip'
      const title = `${started} · ${type}`
      if (query?.trim() && !title.toLowerCase().includes(query.trim().toLowerCase())) return null
      return { id, title }
    })
    .filter((item): item is LookupSelectItem => item !== null)
}

async function fetchTripForPrefill(tripId: string): Promise<TripDetail | null> {
  const params = new URLSearchParams({
    page: '1',
    pageSize: '1',
    ids: tripId,
  })
  const call = await apiCall<{ items: TripDetail[] }>(`/api/taxi_fleet/trips?${params}`)
  const item = Array.isArray(call.result?.items) ? call.result.items[0] : null
  return item ?? null
}

function FieldBlock({
  label,
  required,
  htmlFor,
  children,
}: {
  label: string
  required?: boolean
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <FormFieldLabel label={label} required={required} htmlFor={htmlFor} />
      {children}
    </div>
  )
}

export function DriverFinancialEntryDialog({
  open,
  onOpenChange,
  teamMemberId,
  mode,
  entry = null,
  onSaved,
}: DriverFinancialEntryDialogProps) {
  const t = useT()
  const { organizationId, tenantId } = useOrganizationScopeDetail()
  const { resolveIncomeDocumentTypeLabel, resolveCostTypeLabel } = useTaxiFleetLabels()
  const dialogContentRef = React.useRef<HTMLDivElement | null>(null)
  const draftAttachmentRecordId = React.useId()
  const attachmentRecordId = entry?.id ?? draftAttachmentRecordId

  const isEdit = Boolean(entry?.id)
  const kind = entry?.kind ?? mode
  const isIncomeCreate = kind === 'income' && !isEdit

  const [incomeStep, setIncomeStep] = React.useState<1 | 2>(1)
  const [incomeDocumentType, setIncomeDocumentType] = React.useState<'receipt' | 'invoice'>('receipt')
  const [costType, setCostType] = React.useState<string>('fuel')
  const [tripId, setTripId] = React.useState<string | null>(null)
  const [customerEntityId, setCustomerEntityId] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [documentNumber, setDocumentNumber] = React.useState('')
  const [occurredAtDate, setOccurredAtDate] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [receiptAttachmentId, setReceiptAttachmentId] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isPrefilling, setIsPrefilling] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    const today = isoToDateOnlyValue(new Date().toISOString())
    setIncomeStep(isIncomeCreate ? 1 : 2)
    setIncomeDocumentType(entry?.incomeDocumentType === 'invoice' ? 'invoice' : 'receipt')
    setCostType(entry?.costType ?? 'fuel')
    setTripId(entry?.tripId ?? null)
    setCustomerEntityId(
      readTripCustomerEntityId({
        customerPersonId: entry?.customerPersonId ?? null,
        customerCompanyId: entry?.customerCompanyId ?? null,
      }) ?? '',
    )
    setAmount(entry?.amount ?? '')
    setDocumentNumber(entry?.documentNumber ?? '')
    setOccurredAtDate(entry?.occurredAt ? isoToDateOnlyValue(entry.occurredAt) : today)
    setNotes(entry?.notes ?? '')
    setReceiptAttachmentId(entry?.receiptAttachmentId ?? null)
  }, [entry, isIncomeCreate, open])

  const handleCancel = React.useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const applyTripPrefill = React.useCallback(async (selectedTripId: string) => {
    setIsPrefilling(true)
    try {
      const trip = await fetchTripForPrefill(selectedTripId)
      if (!trip) return
      const customerId = readTripCustomerEntityId({
        customerPersonId: trip.customerPersonId ?? null,
        customerCompanyId: trip.customerCompanyId ?? null,
      })
      if (customerId) setCustomerEntityId(customerId)
      if (trip.revenueAmount) setAmount(String(trip.revenueAmount))
      const tripDate = trip.endedAt ?? trip.startedAt
      if (tripDate) setOccurredAtDate(isoToDateOnlyValue(tripDate))
      if (trip.notes) setNotes(trip.notes)
    } finally {
      setIsPrefilling(false)
    }
  }, [])

  const handleIncomeStepContinue = React.useCallback(async () => {
    if (!documentNumber.trim()) {
      flash(t('taxi_fleet.financial.validation.documentNumber', 'Enter the document number.'), 'error')
      return
    }
    if (tripId) {
      await applyTripPrefill(tripId)
    }
    setIncomeStep(2)
  }, [applyTripPrefill, documentNumber, t, tripId])

  const handleSave = React.useCallback(async () => {
    if (!organizationId || !tenantId) return
    const occurredAt = parseDateOnlyValue(occurredAtDate)
    const parsedAmount = parseNumericValue(amount)
    if (!occurredAt) {
      flash(t('taxi_fleet.financial.validation.date', 'Enter a valid date.'), 'error')
      return
    }
    if (parsedAmount == null || parsedAmount <= 0) {
      flash(t('taxi_fleet.financial.validation.amount', 'Enter a valid amount.'), 'error')
      return
    }
    if (!documentNumber.trim()) {
      flash(t('taxi_fleet.financial.validation.documentNumber', 'Enter the document number.'), 'error')
      return
    }
    if (kind === 'income' && !customerEntityId.trim() && !tripId) {
      flash(t('taxi_fleet.trips.errors.customerRequired', 'Select a customer (person or company).'), 'error')
      return
    }
    setIsSaving(true)
    try {
      const payload = {
        teamMemberId,
        kind,
        incomeDocumentType: kind === 'income' ? incomeDocumentType : null,
        costType: kind === 'expense' ? costType : null,
        tripId: tripId ?? null,
        customerEntityId: kind === 'income' ? customerEntityId.trim() || undefined : undefined,
        amount: parsedAmount,
        currencyCode: 'PLN',
        documentNumber: documentNumber.trim(),
        occurredAt: occurredAt.toISOString(),
        receiptAttachmentId: receiptAttachmentId ?? null,
        notes: notes.trim() || null,
      }
      if (isEdit && entry?.id) {
        await updateCrud('taxi_fleet/financial-entries', { id: entry.id, ...payload }, {
          errorMessage: t('taxi_fleet.financial.saveError', 'Could not save entry.'),
        })
        flash(t('taxi_fleet.financial.updated', 'Entry updated.'), 'success')
      } else {
        await createCrud('taxi_fleet/financial-entries', {
          tenantId,
          organizationId,
          ...payload,
        }, {
          errorMessage: t('taxi_fleet.financial.saveError', 'Could not save entry.'),
        })
        flash(t('taxi_fleet.financial.created', 'Entry registered.'), 'success')
      }
      onOpenChange(false)
      onSaved()
    } finally {
      setIsSaving(false)
    }
  }, [
    amount,
    costType,
    customerEntityId,
    documentNumber,
    entry?.id,
    incomeDocumentType,
    isEdit,
    kind,
    notes,
    occurredAtDate,
    onOpenChange,
    onSaved,
    organizationId,
    receiptAttachmentId,
    t,
    teamMemberId,
    tenantId,
    tripId,
  ])

  const handleDialogKeyDown = useTaxiFleetDialogShortcuts({
    contentRef: dialogContentRef,
    onCancel: handleCancel,
    canSubmit: !isSaving && !isPrefilling,
  })

  const title =
    kind === 'income'
      ? isEdit
        ? t('taxi_fleet.financial.editIncomeTitle', 'Edit customer document')
        : t('taxi_fleet.financial.createIncomeTitle', 'Register receipt or invoice')
      : isEdit
        ? t('taxi_fleet.financial.editExpenseTitle', 'Edit cost')
        : t('taxi_fleet.financial.createExpenseTitle', 'Register cost')

  const renderLinkedTripField = (required = false) => (
    <FieldBlock label={t('taxi_fleet.financial.linkedTrip', 'Linked trip')} required={required}>
      <LookupSelect
        value={tripId}
        onChange={setTripId}
        options={[]}
        fetchOptions={(query) => fetchDriverTripOptions(teamMemberId, query)}
        placeholder={t('taxi_fleet.financial.linkedTripPlaceholder', 'Optional trip…')}
        disabled={isSaving || isPrefilling}
      />
    </FieldBlock>
  )

  const renderIncomeStep1 = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('taxi_fleet.financial.step1Description', 'Select a linked trip and enter the document number. Trip data will prefill the form.')}
      </p>
      {renderLinkedTripField(false)}
      <FieldBlock label={t('taxi_fleet.financial.documentNumber', 'Document number')} required htmlFor="financial-document-number">
        <input
          id="financial-document-number"
          type="text"
          value={documentNumber}
          onChange={(event) => setDocumentNumber(event.target.value)}
          placeholder={t('taxi_fleet.financial.documentNumberIncome', 'Receipt or invoice number')}
          disabled={isSaving}
          className={CRUD_FORM_TEXT_INPUT_CLASS}
        />
      </FieldBlock>
    </div>
  )

  const renderIncomeForm = () => (
    <div className="space-y-4">
      <FieldBlock label={t('taxi_fleet.financial.documentType', 'Document type')} required htmlFor="financial-document-type">
        <SelectInputField
          id="financial-document-type"
          value={incomeDocumentType}
          onChange={(value) => setIncomeDocumentType(value as 'receipt' | 'invoice')}
          disabled={isSaving}
        >
          {TAXI_FLEET_INCOME_DOCUMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {resolveIncomeDocumentTypeLabel(type)}
            </option>
          ))}
        </SelectInputField>
      </FieldBlock>
      <FieldBlock label={t('taxi_fleet.financial.issueDate', 'Issue date')} required htmlFor="financial-issue-date">
        <DateInputField
          id="financial-issue-date"
          value={occurredAtDate}
          onChange={setOccurredAtDate}
          disabled={isSaving}
        />
      </FieldBlock>
      <FieldBlock label={t('taxi_fleet.financial.documentNumber', 'Document number')} required htmlFor="financial-document-number-full">
        <input
          id="financial-document-number-full"
          type="text"
          value={documentNumber}
          onChange={(event) => setDocumentNumber(event.target.value)}
          disabled={isSaving}
          className={CRUD_FORM_TEXT_INPUT_CLASS}
        />
      </FieldBlock>
      {renderLinkedTripField(false)}
      <FieldBlock label={t('taxi_fleet.trips.customer', 'Customer')} required={!tripId} htmlFor="financial-customer">
        <TripCustomerField value={customerEntityId} onChange={setCustomerEntityId} disabled={isSaving} />
      </FieldBlock>
      <FieldBlock label={t('taxi_fleet.financial.finalPrice', 'Final price')} required htmlFor="financial-amount">
        <MoneyInputField id="financial-amount" value={amount} onChange={setAmount} disabled={isSaving} />
      </FieldBlock>
      <FieldBlock label={t('taxi_fleet.financial.attachment', 'Attachment')}>
        <FinancialAttachmentField
          attachmentId={receiptAttachmentId}
          recordId={attachmentRecordId}
          onChange={setReceiptAttachmentId}
          disabled={isSaving}
        />
      </FieldBlock>
      <FieldBlock label={t('taxi_fleet.trips.notes', 'Notes')} htmlFor="financial-notes">
        <NotesInputField id="financial-notes" value={notes} onChange={setNotes} disabled={isSaving} />
      </FieldBlock>
    </div>
  )

  const renderExpenseForm = () => (
    <div className="space-y-4">
      <FieldBlock label={t('taxi_fleet.financial.costType', 'Cost type')} required htmlFor="financial-cost-type">
        <SelectInputField
          id="financial-cost-type"
          value={costType}
          onChange={setCostType}
          disabled={isSaving}
        >
          {TAXI_FLEET_COST_TYPES.map((type) => (
            <option key={type} value={type}>
              {resolveCostTypeLabel(type)}
            </option>
          ))}
        </SelectInputField>
      </FieldBlock>
      <FieldBlock label={t('taxi_fleet.financial.occurredAt', 'Date')} required htmlFor="financial-expense-date">
        <DateInputField
          id="financial-expense-date"
          value={occurredAtDate}
          onChange={setOccurredAtDate}
          disabled={isSaving}
        />
      </FieldBlock>
      <FieldBlock label={t('taxi_fleet.financial.documentNumber', 'Document number')} required htmlFor="financial-expense-number">
        <input
          id="financial-expense-number"
          type="text"
          value={documentNumber}
          onChange={(event) => setDocumentNumber(event.target.value)}
          placeholder={t('taxi_fleet.financial.documentNumberExpense', 'Receipt number')}
          disabled={isSaving}
          className={CRUD_FORM_TEXT_INPUT_CLASS}
        />
      </FieldBlock>
      <FieldBlock label={t('taxi_fleet.financial.amount', 'Amount')} required htmlFor="financial-expense-amount">
        <MoneyInputField id="financial-expense-amount" value={amount} onChange={setAmount} disabled={isSaving} />
      </FieldBlock>
      {renderLinkedTripField(false)}
      <FieldBlock label={t('taxi_fleet.financial.attachment', 'Attachment')}>
        <FinancialAttachmentField
          attachmentId={receiptAttachmentId}
          recordId={attachmentRecordId}
          onChange={setReceiptAttachmentId}
          disabled={isSaving}
        />
      </FieldBlock>
      <FieldBlock label={t('taxi_fleet.trips.notes', 'Notes')} htmlFor="financial-expense-notes">
        <NotesInputField id="financial-expense-notes" value={notes} onChange={setNotes} disabled={isSaving} />
      </FieldBlock>
    </div>
  )

  const dialogBody =
    kind === 'income'
      ? isIncomeCreate && incomeStep === 1
        ? renderIncomeStep1()
        : renderIncomeForm()
      : renderExpenseForm()

  const dialogFooter =
    kind === 'income' && isIncomeCreate && incomeStep === 1 ? (
      <>
        <Button type="button" variant="outline" onClick={handleCancel} disabled={isSaving}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button type="submit" disabled={isSaving || isPrefilling}>
          {t('taxi_fleet.financial.actions.next', 'Continue')}
        </Button>
      </>
    ) : (
      <>
        {kind === 'income' && isIncomeCreate ? (
          <Button type="button" variant="outline" onClick={() => setIncomeStep(1)} disabled={isSaving}>
            {t('taxi_fleet.financial.actions.back', 'Back')}
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={handleCancel} disabled={isSaving}>
            {t('common.cancel', 'Cancel')}
          </Button>
        )}
        <Button type="submit" disabled={isSaving}>
          {t('taxi_fleet.financial.form.submitSave', 'Save (⌘/Ctrl + Enter)')}
        </Button>
      </>
    )

  return (
    <TaxiFleetDialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      contentRef={dialogContentRef}
      onKeyDown={handleDialogKeyDown}
    >
      <TaxiFleetDialogForm
        onSubmit={(event) => {
          event.preventDefault()
          if (kind === 'income' && isIncomeCreate && incomeStep === 1) {
            void handleIncomeStepContinue()
            return
          }
          void handleSave()
        }}
        body={dialogBody}
        footer={dialogFooter}
      />
    </TaxiFleetDialogFrame>
  )
}
