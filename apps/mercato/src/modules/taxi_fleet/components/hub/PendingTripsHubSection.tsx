"use client"

import * as React from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowRight } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { Button } from '@open-mercato/ui/primitives/button'
import { TAXI_FLEET_BASE } from '../../backend/taxi-fleet/paths'

type PendingTripRow = {
  id: string
  startedAt?: string | null
  endedAt?: string | null
  notes?: string | null
  metadata?: Record<string, unknown> | null
  revenueAmount?: string | null
}

type PendingTripsResponse = { items: PendingTripRow[]; total?: number }

function resolveTripTitle(row: PendingTripRow, fallback: string): string {
  const metadata = row.metadata
  if (metadata && typeof metadata === 'object') {
    const strapi = metadata.strapi
    if (strapi && typeof strapi === 'object') {
      const from = typeof (strapi as Record<string, unknown>).fromAddress === 'string'
        ? (strapi as Record<string, unknown>).fromAddress
        : typeof (strapi as Record<string, unknown>).from === 'string'
          ? (strapi as Record<string, unknown>).from
          : ''
      const to = typeof (strapi as Record<string, unknown>).toAddress === 'string'
        ? (strapi as Record<string, unknown>).toAddress
        : typeof (strapi as Record<string, unknown>).to === 'string'
          ? (strapi as Record<string, unknown>).to
          : ''
      if (from && to) return `${from} → ${to}`
    }
  }
  const notes = row.notes?.trim()
  if (notes?.length) return notes.split('\n')[0] ?? fallback
  return fallback
}

export function PendingTripsHubSection() {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const [rows, setRows] = React.useState<PendingTripRow[]>([])
  const [total, setTotal] = React.useState(0)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const params = new URLSearchParams({
        page: '1',
        pageSize: '5',
        unscheduled: 'true',
        status: 'new',
      })
      const call = await apiCall<PendingTripsResponse>(`/api/taxi_fleet/trips?${params}`)
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
          <h2 className="text-sm font-semibold">{t('taxi_fleet.hub.pendingTrips.title', 'Trips awaiting scheduling')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('taxi_fleet.hub.pendingTrips.description', 'Bookings from the website and other channels without an assigned driver.')}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href={`${TAXI_FLEET_BASE}/trips?unscheduled=1`}>
            {t('taxi_fleet.hub.pendingTrips.viewAll', 'View all')}
            <ArrowRight className="ml-1 size-4" aria-hidden />
          </Link>
        </Button>
      </div>
      <div className="mt-4 space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('taxi_fleet.hub.loading', 'Loading…')}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('taxi_fleet.hub.pendingTrips.empty', 'No trips awaiting scheduling.')}</p>
        ) : (
          rows.map((row) => {
            const startedAt = row.startedAt ? new Date(row.startedAt) : null
            const scheduleLabel =
              startedAt && !Number.isNaN(startedAt.getTime())
                ? format(startedAt, 'dd.MM.yyyy HH:mm')
                : t('taxi_fleet.hub.pendingTrips.noSchedule', 'No schedule')
            return (
              <Link
                key={row.id}
                href={`${TAXI_FLEET_BASE}/trips/${encodeURIComponent(row.id)}`}
                className="block rounded-md border border-border/70 px-3 py-2 transition-colors hover:bg-muted/40"
              >
                <div className="text-sm font-medium">
                  {resolveTripTitle(row, t('taxi_fleet.hub.pendingTrips.untitled', 'Trip request'))}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{scheduleLabel}</div>
              </Link>
            )
          })
        )}
      </div>
      {!loading && total > rows.length ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {t('taxi_fleet.hub.pendingTrips.more', '+{count} more', { count: String(total - rows.length) })}
        </p>
      ) : null}
    </section>
  )
}
