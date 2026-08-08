"use client"

import * as React from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { fetchProcurementCustomerAssociationPreview } from '@open-mercato/core/modules/procurement/lib/procurementEntitySearch'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type TripCustomerPreviewProps = {
  customerPersonId?: string | null
  customerCompanyId?: string | null
  fallbackLabel?: string
  openInNewWindow?: boolean
}

export function TripCustomerPreview({
  customerPersonId,
  customerCompanyId,
  fallbackLabel = '—',
  openInNewWindow = false,
}: TripCustomerPreviewProps) {
  const t = useT()
  const entityId = customerPersonId ?? customerCompanyId ?? null
  const [preview, setPreview] = React.useState<{
    title: string
    recordHref: string
  } | null>(null)

  React.useEffect(() => {
    let cancelled = false
    if (!entityId) {
      setPreview(null)
      return
    }
    void fetchProcurementCustomerAssociationPreview(entityId).then((row) => {
      if (cancelled) return
      if (row) {
        setPreview({ title: row.title, recordHref: row.recordHref ?? '#' })
      } else {
        setPreview({ title: entityId, recordHref: '#' })
      }
    })
    return () => {
      cancelled = true
    }
  }, [entityId])

  if (!entityId) return <>{fallbackLabel}</>
  if (!preview) return <>{entityId}</>

  if (preview.recordHref === '#') {
    return <>{preview.title}</>
  }

  if (openInNewWindow) {
    return (
      <Link
        href={preview.recordHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex max-w-full items-center gap-1.5 text-primary hover:underline"
        aria-label={t('taxi_fleet.calendar.openCustomerNewWindow', 'Open customer in new window')}
      >
        <span className="min-w-0 truncate">{preview.title}</span>
        <ExternalLink className="size-3.5 shrink-0" aria-hidden />
      </Link>
    )
  }

  return (
    <Link href={preview.recordHref} className="text-primary hover:underline">
      {preview.title}
    </Link>
  )
}
