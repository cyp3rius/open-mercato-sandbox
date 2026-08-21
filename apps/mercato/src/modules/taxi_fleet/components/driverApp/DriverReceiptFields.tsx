'use client'

import React from 'react'
import { Camera, X } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { Button } from '@open-mercato/ui/primitives/button'
import {
  driverFieldClass,
  driverLabelClass,
  driverSecondaryActionClass,
} from './driverUi'

type Props = {
  documentNumber: string
  attachmentId: string | null
  attachmentName: string | null
  draftRecordId: string
  required?: boolean
  disabled?: boolean
  onDocumentNumberChange: (value: string) => void
  onAttachmentChange: (next: { id: string | null; fileName: string | null }) => void
  onOfflineFile?: (file: File) => Promise<{ blobId: string; fileName: string } | null>
  onOfflineStored?: (next: { blobId: string; fileName: string }) => void
}

export function DriverReceiptFields({
  documentNumber,
  attachmentId,
  attachmentName,
  draftRecordId,
  required = false,
  disabled = false,
  onDocumentNumberChange,
  onAttachmentChange,
  onOfflineFile,
  onOfflineStored,
}: Props) {
  const t = useT()
  const fileRef = React.useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [uploadError, setUploadError] = React.useState<string | null>(null)
  const hasPhoto = Boolean(attachmentId || attachmentName)

  async function uploadFile(file: File) {
    setUploading(true)
    setUploadError(null)
    try {
      if (!navigator.onLine && onOfflineFile && onOfflineStored) {
        const stored = await onOfflineFile(file)
        if (!stored) throw new Error('offline store failed')
        onOfflineStored(stored)
        return
      }
      const form = new FormData()
      form.set('recordId', draftRecordId)
      form.set('file', file)
      const call = await apiCall<{ id: string; fileName: string }>(
        '/api/taxi_fleet/driver/attachments',
        { method: 'POST', body: form },
      )
      if (!call.ok || !call.result?.id) {
        if (onOfflineFile && onOfflineStored) {
          const stored = await onOfflineFile(file)
          if (stored) {
            onOfflineStored(stored)
            return
          }
        }
        throw new Error('upload failed')
      }
      onAttachmentChange({ id: call.result.id, fileName: call.result.fileName || file.name })
    } catch {
      setUploadError(
        t('taxi_fleet.driverApp.receipt.uploadFailed', 'Could not upload receipt photo.'),
      )
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className={driverLabelClass}>
          {t('taxi_fleet.driverApp.receipt.photo', 'Receipt / invoice photo')}
          {required ? <span className="text-red-600"> *</span> : null}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf"
          capture="environment"
          className="hidden"
          disabled={disabled || uploading}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void uploadFile(file)
          }}
        />
        {hasPhoto ? (
          <div className="flex items-center justify-between gap-2 rounded-md border border-[#DBDFE9] bg-[#F9F9F9] px-3 py-2.5">
            <div className="min-w-0 truncate text-sm font-medium text-[#071437]">
              {attachmentName || t('taxi_fleet.driverApp.receipt.photoAttached', 'Photo attached')}
              {!attachmentId && attachmentName ? (
                <span className="ml-2 text-xs font-normal text-[#78829D]">
                  ({t('taxi_fleet.driverApp.receipt.queuedOffline', 'saved offline')})
                </span>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 px-2 text-[#78829D]"
              disabled={disabled || uploading}
              onClick={() => onAttachmentChange({ id: null, fileName: null })}
              aria-label={t('taxi_fleet.driverApp.receipt.photoClear', 'Remove receipt photo')}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            className={`${driverSecondaryActionClass} gap-1.5`}
            disabled={disabled || uploading}
            onClick={() => fileRef.current?.click()}
          >
            <Camera className="size-3.5" aria-hidden />
            {uploading
              ? t('taxi_fleet.driverApp.receipt.uploading', 'Uploading…')
              : t('taxi_fleet.driverApp.receipt.addPhoto', 'Add photo')}
          </Button>
        )}
        {uploadError ? <div className="mt-1.5 text-sm text-red-600">{uploadError}</div> : null}
      </div>

      <div>
        <label htmlFor="receiptDocumentNumber" className={driverLabelClass}>
          {t('taxi_fleet.driverApp.receipt.numberOptional', 'Receipt / invoice number')}
        </label>
        <input
          id="receiptDocumentNumber"
          name="receiptDocumentNumber"
          value={documentNumber}
          disabled={disabled}
          onChange={(event) => onDocumentNumberChange(event.target.value)}
          className={driverFieldClass}
          autoComplete="off"
        />
      </div>
    </div>
  )
}
