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
  skippedCount: number
  errorCount: number
  errorSummary?: { errors?: Array<{ row?: number; message: string }> } | null
}

type RunsResponse = {
  items?: SyncRunRow[]
}

type PlatformSyncRunsPanelProps = {
  reloadToken?: number
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'succeeded') return 'default'
  if (status === 'partial') return 'secondary'
  if (status === 'failed') return 'destructive'
  return 'outline'
}

export function PlatformSyncRunsPanel({ reloadToken = 0 }: PlatformSyncRunsPanelProps) {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const [rows, setRows] = React.useState<SyncRunRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [localReload, setLocalReload] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const call = await apiCall<RunsResponse>('/api/taxi_fleet/platform-sync/runs?page=1&pageSize=5')
      if (cancelled) return
      setRows(Array.isArray(call.result?.items) ? call.result.items : [])
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [reloadToken, localReload, scopeVersion])

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
        <LoadingMessage message={t('common.loading', 'Loading…')} />
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {t('taxi_fleet.platformSync.runs.empty', 'No sync runs yet.')}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => {
            const firstError = row.errorSummary?.errors?.[0]
            return (
              <li key={row.id} className="rounded-md border border-border/60 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                  <span className="font-medium">{row.platform}</span>
                  <span className="text-muted-foreground">{row.trigger}</span>
                  <span className="text-muted-foreground">
                    {new Date(row.startedAt).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {t(
                    'taxi_fleet.platformSync.runs.counts',
                    'Fetched {fetched} · upserted {upserted} · skipped {skipped} · errors {errors}',
                    {
                      fetched: String(row.fetchedCount),
                      upserted: String(row.upsertedCount),
                      skipped: String(row.skippedCount),
                      errors: String(row.errorCount),
                    },
                  )}
                </div>
                {firstError ? (
                  <div className="mt-1 text-xs text-destructive">
                    {firstError.row ? `Row ${firstError.row}: ` : ''}
                    {firstError.message}
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
