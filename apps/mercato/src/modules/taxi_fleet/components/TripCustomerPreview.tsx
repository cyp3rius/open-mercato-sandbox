'use client'

import * as React from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { fetchProcurementCustomerAssociationPreview } from '@open-mercato/core/modules/procurement/lib/procurementEntitySearch'
import { useT } from '@open-mercato/shared/lib/i18n/context'

const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type TripCustomerPreviewProps = {
  customerPersonId?: string | null
  customerCompanyId?: string | null
  fallbackLabel?: string
  openInNewWindow?: boolean
}

type PreviewState = {
  title: string
  recordHref: string
} | null

const previewCache = new Map<string, PreviewState>()

function isUnresolvedLabel(value: string | null | undefined): boolean {
  if (!value) return true
  return UUID_LIKE.test(value.trim())
}

export function TripCustomerPreview({
  customerPersonId,
  customerCompanyId,
  fallbackLabel,
  openInNewWindow = false,
}: TripCustomerPreviewProps) {
  const t = useT()
  const entityId = customerPersonId ?? customerCompanyId ?? null
  const unresolvedLabel =
    fallbackLabel ?? t('taxi_fleet.trips.customerUnknown', 'Unknown customer')
  const [preview, setPreview] = React.useState<PreviewState>(() =>
    entityId ? previewCache.get(entityId) ?? null : null,
  )
  const [loading, setLoading] = React.useState(() => Boolean(entityId) && !previewCache.has(entityId ?? ''))

  React.useEffect(() => {
    let cancelled = false
    if (!entityId) {
      setPreview(null)
      setLoading(false)
      return
    }
    const cached = previewCache.get(entityId)
    if (cached) {
      setPreview(cached)
      setLoading(false)
      return
    }
    setLoading(true)
    void fetchProcurementCustomerAssociationPreview(entityId).then((row) => {
      if (cancelled) return
      const next: PreviewState = row
        ? {
            title: isUnresolvedLabel(row.title) ? unresolvedLabel : row.title,
            recordHref: row.recordHref ?? '#',
          }
        : { title: unresolvedLabel, recordHref: '#' }
      previewCache.set(entityId, next)
      setPreview(next)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [entityId, unresolvedLabel])

  if (!entityId) return <>{fallbackLabel ?? '—'}</>
  if (loading || !preview) {
    return <span className="text-muted-foreground">…</span>
  }

  const label = isUnresolvedLabel(preview.title) ? unresolvedLabel : preview.title

  if (preview.recordHref === '#') {
    return <span className="truncate">{label}</span>
  }

  if (openInNewWindow) {
    return (
      <Link
        href={preview.recordHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex max-w-full items-center gap-1.5 text-primary hover:underline"
        aria-label={t('taxi_fleet.calendar.openCustomerNewWindow', 'Open customer in new window')}
        onClick={(event) => event.stopPropagation()}
      >
        <span className="min-w-0 truncate">{label}</span>
        <ExternalLink className="size-3.5 shrink-0" aria-hidden />
      </Link>
    )
  }

  return (
    <Link
      href={preview.recordHref}
      className="text-primary hover:underline"
      onClick={(event) => event.stopPropagation()}
    >
      {label}
    </Link>
  )
}
