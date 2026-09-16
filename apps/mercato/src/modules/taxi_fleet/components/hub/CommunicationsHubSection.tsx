'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { Button } from '@open-mercato/ui/primitives/button'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { TAXI_FLEET_BASE } from '../../backend/taxi-fleet/paths'

type CommunicationRow = {
  id: string
  kind: string
  title: string
  status: string
  sentAt?: string | null
  recipientCounts?: {
    total: number
    sent: number
    read: number
  }
}

type ListResponse = { items: CommunicationRow[]; total?: number }

export function CommunicationsHubSection() {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const [rows, setRows] = React.useState<CommunicationRow[]>([])
  const [total, setTotal] = React.useState(0)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const params = new URLSearchParams({
        page: '1',
        pageSize: '5',
        status: 'sent,partial',
        sortField: 'sentAt',
        sortDir: 'desc',
      })
      const call = await apiCall<ListResponse>(`/api/taxi_fleet/driver-communications?${params}`)
      if (cancelled) return
      setRows(Array.isArray(call.result?.items) ? call.result.items : [])
      setTotal(call.result?.total ?? call.result?.items?.length ?? 0)
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [scopeVersion])

  return (
    <section className="rounded-lg border bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">
            {t('taxi_fleet.hub.communications.title', 'Communications')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              'taxi_fleet.hub.communications.description',
              'Last five messages sent to drivers.',
            )}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href={`${TAXI_FLEET_BASE}/communications`}>
            {t('taxi_fleet.hub.communications.open', 'Open communications')}
            <ArrowRight className="ml-1 size-4" aria-hidden />
          </Link>
        </Button>
      </div>
      <div className="mt-4 space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('taxi_fleet.hub.loading', 'Loading…')}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('taxi_fleet.hub.communications.empty', 'No sent communications yet.')}
          </p>
        ) : (
          rows.map((row) => {
            const counts = row.recipientCounts
            return (
              <Link
                key={row.id}
                href={`${TAXI_FLEET_BASE}/communications/${encodeURIComponent(row.id)}`}
                className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{row.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="font-normal">
                      {t(`taxi_fleet.communications.kind.${row.kind}`, row.kind)}
                    </Badge>
                    <span>
                      {row.sentAt
                        ? new Date(row.sentAt).toLocaleString()
                        : t('taxi_fleet.communications.list.noSentAt', '—')}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right text-xs text-muted-foreground">
                  {counts
                    ? t(
                        'taxi_fleet.hub.communications.delivery',
                        '{sent}/{total} · {read} read',
                        {
                          sent: String(counts.sent),
                          total: String(counts.total),
                          read: String(counts.read),
                        },
                      )
                    : t(`taxi_fleet.communications.status.${row.status}`, row.status)}
                </div>
              </Link>
            )
          })
        )}
      </div>
      {!loading && total > rows.length ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {t('taxi_fleet.hub.pendingTrips.more', '+{count} more', {
            count: String(total - rows.length),
          })}
        </p>
      ) : null}
    </section>
  )
}
