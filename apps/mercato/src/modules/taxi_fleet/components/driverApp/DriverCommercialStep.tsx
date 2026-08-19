'use client'

import React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { parseNumericValue, sanitizePercentTypingInput } from '@open-mercato/shared/lib/numeric'
import { DriverCustomerField } from './DriverCustomerField'
import { DriverReceiptFields } from './DriverReceiptFields'
import { DriverTripTypePicker } from './DriverTripTypePicker'
import { DriverPlatformPicker } from './DriverPlatformPicker'
import {
  driverFieldClass,
  driverLabelClass,
  driverSectionDescClass,
  driverSectionTitleClass,
} from './driverUi'
import type { TaxiFleetTripType } from '../useTaxiFleetLabels'
import type { TaxiFleetTripPlatform } from '../../lib/tripPlatforms'

export type DriverCommercialValue = {
  tripType: TaxiFleetTripType
  platform: TaxiFleetTripPlatform | null
  customerEntityId: string
  customerLabel: string
  revenueAmount: string
  receiptDocumentNumber: string
  receiptAttachmentId: string | null
  receiptAttachmentName: string | null
  receiptBlobId: string | null
  notes: string
}

type Props = {
  value: DriverCommercialValue
  disabled?: boolean
  receiptDraftRecordId: string
  onChange: (next: DriverCommercialValue) => void
  onReceiptFileOffline?: (file: File) => Promise<{ blobId: string; fileName: string } | null>
}

export function DriverCommercialStep({
  value,
  disabled,
  receiptDraftRecordId,
  onChange,
  onReceiptFileOffline,
}: Props) {
  const t = useT()

  return (
    <div className="space-y-4">
      <div className={driverSectionTitleClass}>
        {t('taxi_fleet.driverApp.trips.formBasics', 'Trip details')}
      </div>
      <p className={driverSectionDescClass}>
        {t(
          'taxi_fleet.driverApp.trips.formBasicsHint',
          'Fill in the trip information and save your changes.',
        )}
      </p>

      <DriverTripTypePicker
        value={value.tripType}
        disabled={disabled}
        onChange={(tripType) =>
          onChange({
            ...value,
            tripType,
            ...(tripType !== 'client'
              ? { customerEntityId: '', customerLabel: '' }
              : {}),
          })
        }
      />

      <DriverPlatformPicker
        value={value.platform}
        disabled={disabled}
        onChange={(platform) => onChange({ ...value, platform })}
      />

      {value.tripType === 'client' ? (
        <DriverCustomerField
          value={value.customerEntityId}
          label={value.customerLabel}
          disabled={disabled}
          onChange={(next) =>
            onChange({ ...value, customerEntityId: next.id, customerLabel: next.label })
          }
        />
      ) : null}

      <div>
        <label htmlFor="revenueAmount" className={driverLabelClass}>
          {t('taxi_fleet.driverApp.trips.revenue', 'Collected payment')}
        </label>
        <div className="flex min-w-0 items-stretch">
          <input
            id="revenueAmount"
            type="text"
            inputMode="decimal"
            disabled={disabled}
            value={value.revenueAmount}
            onChange={(event) =>
              onChange({
                ...value,
                revenueAmount: sanitizePercentTypingInput(event.target.value, 2),
              })
            }
            onBlur={() => {
              const parsed = parseNumericValue(value.revenueAmount)
              onChange({
                ...value,
                revenueAmount: parsed === null || parsed < 0 ? '0.00' : parsed.toFixed(2),
              })
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

      <div className="border-t border-[#F1F1F4] pt-4">
        <div className={driverSectionTitleClass}>
          {t('taxi_fleet.driverApp.receipt.title', 'Receipt')}
        </div>
        <p className={`${driverSectionDescClass} mb-4`}>
          {t(
            'taxi_fleet.driverApp.receipt.sectionHint',
            'Optionally add the receipt number and/or a photo.',
          )}
        </p>
        <DriverReceiptFields
          documentNumber={value.receiptDocumentNumber}
          attachmentId={value.receiptAttachmentId}
          attachmentName={value.receiptAttachmentName}
          draftRecordId={receiptDraftRecordId}
          disabled={disabled}
          onDocumentNumberChange={(receiptDocumentNumber) =>
            onChange({ ...value, receiptDocumentNumber })
          }
          onAttachmentChange={(next) =>
            onChange({
              ...value,
              receiptAttachmentId: next.id,
              receiptAttachmentName: next.fileName,
              receiptBlobId: next.id ? null : null,
            })
          }
          onOfflineFile={onReceiptFileOffline}
          onOfflineStored={(next) =>
            onChange({
              ...value,
              receiptBlobId: next.blobId,
              receiptAttachmentId: null,
              receiptAttachmentName: next.fileName,
            })
          }
        />
      </div>

      <div>
        <label htmlFor="notes" className={driverLabelClass}>
          {t('taxi_fleet.driverApp.trips.notes', 'Notes')}
        </label>
        <textarea
          id="notes"
          rows={3}
          disabled={disabled}
          value={value.notes}
          onChange={(event) => onChange({ ...value, notes: event.target.value })}
          className={`${driverFieldClass} min-h-22 py-2.5`}
        />
      </div>
    </div>
  )
}

export function validateCommercialStep(
  value: DriverCommercialValue,
  t: (key: string, fallback: string) => string,
): string | null {
  if (value.tripType === 'client' && !value.customerEntityId) {
    return t(
      'taxi_fleet.driverApp.trips.customerRequired',
      'Select or create a customer for client trips.',
    )
  }
  const revenue = parseNumericValue(value.revenueAmount)
  if (revenue === null || revenue < 0) {
    return t('taxi_fleet.driverApp.trips.revenueInvalid', 'Enter a valid revenue amount.')
  }
  return null
}
