'use client'

import React from 'react'
import { ExternalLink, FileText } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { driverMutedTextClass } from './driverUi'

type Props = {
  attachmentId: string
}

export function DriverReceiptPreview({ attachmentId }: Props) {
  const t = useT()
  const [showImage, setShowImage] = React.useState(true)
  const fileUrl = `/api/attachments/file/${encodeURIComponent(attachmentId)}`
  const imageUrl = `/api/attachments/image/${encodeURIComponent(attachmentId)}?width=720`

  return (
    <div className="mt-2 space-y-2">
      {showImage ? (
        <a
          href={fileUrl}
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded-lg border border-[#DBDFE9] bg-[#F9F9F9]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={t('taxi_fleet.driverApp.receipt.photo', 'Receipt photo')}
            className="max-h-72 w-full object-contain"
            onError={() => setShowImage(false)}
          />
        </a>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-[#DBDFE9] bg-[#F9F9F9] px-3 py-3">
          <FileText className="size-5 shrink-0 text-[#78829D]" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-[#071437]">
              {t('taxi_fleet.driverApp.receipt.fileReady', 'Receipt file')}
            </div>
            <div className={driverMutedTextClass}>
              {t('taxi_fleet.driverApp.receipt.openHint', 'Open to view the attached file.')}
            </div>
          </div>
        </div>
      )}
      <Button type="button" variant="ghost" className="h-9 w-full gap-2 text-[#056EE9]" asChild>
        <a href={fileUrl} target="_blank" rel="noreferrer">
          <ExternalLink className="size-4" aria-hidden />
          {t('taxi_fleet.driverApp.receipt.open', 'Open receipt')}
        </a>
      </Button>
    </div>
  )
}
