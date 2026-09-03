"use client"

import * as React from 'react'
import { RefreshCw } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { Button } from '@open-mercato/ui/primitives/button'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { LoadingMessage } from '@open-mercato/ui/backend/detail'

type SyncRunRow = {
  id: string
  platform: string
  trigger: string
  status: string
  startedAt: string
  finishedAt?: string | null
  fetchedCount: number
  upsertedCount: number
  createdCount?: number
  duplicateCount?: number
  skippedCount: number
  unmappedDriverSkippedCount?: number
  errorCount: number
  errorSummary?: {
    errors?: Array<{ row?: number; message: string }>
    unmappedDriverSkippedCount?: number
  } | null
}

type RunsResponse = {
  items?: SyncRunRow[]
}

type PlatformSyncRunsPanelProps = {
  reloadToken?: number
  /** When true, polls while any run is queued/running. */
  pollActive?: boolean
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'succeeded') return 'default'
  if (status === 'partial' || status === 'queued') return 'secondary'
  if (status === 'failed') return 'destructive'
  return 'outline'
}

function translateRunStatus(
  status: string,
  t: (key: string, fallback: string) => string,
): string {
  switch (status) {
    case 'queued':
      return t('taxi_fleet.platformSync.runs.status.queued', 'Queued')
    case 'running':
      return t('taxi_fleet.platformSync.runs.status.running', 'Running')
    case 'succeeded':
      return t('taxi_fleet.platformSync.runs.status.succeeded', 'Succeeded')
    case 'partial':
      return t('taxi_fleet.platformSync.runs.status.partial', 'Partial')
    case 'failed':
      return t('taxi_fleet.platformSync.runs.status.failed', 'Failed')
    default:
      return status
  }
}

function translateTrigger(
  trigger: string,
  t: (key: string, fallback: string) => string,
): string {
  switch (trigger) {
    case 'csv':
      return t('taxi_fleet.platformSync.runs.trigger.csv', 'CSV import')
    case 'manual':
      return t('taxi_fleet.platformSync.runs.trigger.manual', 'Manual sync')
    case 'schedule':
      return t('taxi_fleet.platformSync.runs.trigger.schedule', 'Scheduled')
    default:
      return trigger
  }
}

function translateRowError(
  message: string,
  t: (key: string, fallback: string) => string,
): string {
  if (message.includes('Unmapped platform driver')) {
    return t(
      'taxi_fleet.platformSync.runs.errors.unmappedDriver',
      'Unmapped platform driver ID — set it on the driver profile.',
    )
  }
  if (message.includes('Driver reassignment conflict')) {
    return t(
      'taxi_fleet.platformSync.runs.errors.driverConflict',
      'Driver reassignment conflict — trip skipped.',
    )
  }
  if (message.includes('No matching payment')) {
    return t(
      'taxi_fleet.platformSync.runs.errors.noPayment',
      'No matching payment revenue for trip.',
    )
  }
  if (message.includes('date ranges') || message.includes('date range')) {
    return t(
      'taxi_fleet.platformSync.import.dateRangeMismatch',
      'Trip Activity and Payments files cover different date ranges.',
    )
  }
  return message
}

export function PlatformSyncRunsPanel({
  reloadToken = 0,
  pollActive = false,
}: PlatformSyncRunsPanelProps) {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const [rows, setRows] = React.useState<SyncRunRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [localReload, setLocalReload] = React.useState(0)

  const load = React.useCallback(async () => {
    setLoading(true)
    const call = await apiCall<RunsResponse>('/api/taxi_fleet/platform-sync/runs?page=1&pageSize=10')
    setRows(Array.isArray(call.result?.items) ? call.result.items : [])
    setLoading(false)
  }, [])

  React.useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      const call = await apiCall<RunsResponse>('/api/taxi_fleet/platform-sync/runs?page=1&pageSize=10')
      if (cancelled) return
      setRows(Array.isArray(call.result?.items) ? call.result.items : [])
      setLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [reloadToken, localReload, scopeVersion])

  const hasActive = rows.some((row) => row.status === 'queued' || row.status === 'running')

  React.useEffect(() => {
    if (!pollActive || !hasActive) return
    const timer = window.setInterval(() => {
      void load()
    }, 4000)
    return () => window.clearInterval(timer)
  }, [hasActive, load, pollActive])

  return (
    <section className="rounded-lg border border-border/70 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">
            {t('taxi_fleet.platformSync.runs.title', 'Recent platform sync runs')}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t(
              'taxi_fleet.platformSync.runs.hint',
              'Skipped rows usually mean a missing platform driver ID on the driver profile.',
            )}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="inline-flex items-center gap-2"
          onClick={() => setLocalReload((value) => value + 1)}
        >
          <RefreshCw className="size-4" aria-hidden />
          {t('taxi_fleet.platformSync.runs.refresh', 'Refresh')}
        </Button>
      </div>

      {loading ? (
        <LoadingMessage label={t('common.loading', 'Loading…')} />
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {t('taxi_fleet.platformSync.runs.empty', 'No sync runs yet.')}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => {
            const firstError = row.errorSummary?.errors?.[0]
            const unmappedSkipped =
              row.unmappedDriverSkippedCount ??
              (typeof row.errorSummary?.unmappedDriverSkippedCount === 'number'
                ? row.errorSummary.unmappedDriverSkippedCount
                : 0)
            return (
              <li key={row.id} className="rounded-md border border-border/60 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant(row.status)}>
                    {translateRunStatus(row.status, t)}
                  </Badge>
                  <span className="font-medium">
                    {t(`taxi_fleet.trips.platforms.${row.platform}`, row.platform)}
                  </span>
                  <span className="text-muted-foreground">{translateTrigger(row.trigger, t)}</span>
                  <span className="text-muted-foreground">
                    {new Date(row.startedAt).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {t(
                    'taxi_fleet.platformSync.runs.counts',
                    'Fetched {fetched} · created {created} · duplicates {duplicates} · skipped {skipped} · errors {errors}',
                    {
                      fetched: String(row.fetchedCount),
                      created: String(row.createdCount ?? row.upsertedCount),
                      duplicates: String(row.duplicateCount ?? 0),
                      skipped: String(row.skippedCount),
                      errors: String(row.errorCount),
                    },
                  )}
                </div>
                {unmappedSkipped > 0 ? (
                  <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                    {t(
                      'taxi_fleet.platformSync.summary.unmappedDriversSkipped',
                      '{count} trips skipped — no driver mapping in CRM.',
                      { count: String(unmappedSkipped) },
                    )}
                  </div>
                ) : null}
                {firstError ? (
                  <div className="mt-1 text-xs text-destructive">
                    {firstError.row
                      ? t('taxi_fleet.platformSync.runs.rowError', 'Row {row}: {message}', {
                          row: String(firstError.row),
                          message: translateRowError(firstError.message, t),
                        })
                      : translateRowError(firstError.message, t)}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
