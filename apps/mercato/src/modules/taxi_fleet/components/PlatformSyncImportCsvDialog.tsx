"use client"

import * as React from 'react'
import { Upload } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { Button } from '@open-mercato/ui/primitives/button'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import {
  TaxiFleetDialogForm,
  TaxiFleetDialogFrame,
  taxiFleetDialogFooterClass,
  taxiFleetDialogScrollBodyClass,
  useTaxiFleetDialogShortcuts,
} from './TaxiFleetDialogShell'
import { TAXI_FLEET_TRIP_PLATFORMS } from '../lib/tripPlatforms'

type PlatformSyncImportCsvDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported?: () => void
}

type ImportResult = {
  runId?: string
  status?: string
  upsertedCount?: number
  skippedCount?: number
  errorCount?: number
}

export function PlatformSyncImportCsvDialog({
  open,
  onOpenChange,
  onImported,
}: PlatformSyncImportCsvDialogProps) {
  const t = useT()
  const { organizationId } = useOrganizationScopeDetail()
  const dialogContentRef = React.useRef<HTMLDivElement | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [platform, setPlatform] = React.useState('bolt')
  const [file, setFile] = React.useState<File | null>(null)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setPlatform('bolt')
    setFile(null)
    setBusy(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [open])

  const canSubmit = Boolean(organizationId && file && platform && !busy)

  const handleCancel = React.useCallback(() => {
    if (busy) return
    onOpenChange(false)
  }, [busy, onOpenChange])

  const handleSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!canSubmit || !file) return
      setBusy(true)
      const form = new FormData()
      form.set('platform', platform)
      form.set('file', file)
      const call = await apiCall<ImportResult>('/api/taxi_fleet/platform-sync/import-csv', {
        method: 'POST',
        body: form,
      })
      setBusy(false)
      if (!call.ok) {
        const message =
          (call.result as { error?: string } | null)?.error ??
          t('taxi_fleet.platformSync.import.error', 'CSV import failed.')
        flash(message, 'error')
        return
      }
      const upserted = call.result?.upsertedCount ?? 0
      const skipped = call.result?.skippedCount ?? 0
      const errors = call.result?.errorCount ?? 0
      flash(
        t(
          'taxi_fleet.platformSync.import.success',
          'Import finished: {upserted} upserted, {skipped} skipped, {errors} errors.',
          { upserted: String(upserted), skipped: String(skipped), errors: String(errors) },
        ),
        errors > 0 && upserted === 0 ? 'error' : 'success',
      )
      onOpenChange(false)
      onImported?.()
    },
    [canSubmit, file, onImported, onOpenChange, platform, t],
  )

  const onKeyDown = useTaxiFleetDialogShortcuts({
    contentRef: dialogContentRef,
    onCancel: handleCancel,
    canSubmit,
  })

  return (
    <TaxiFleetDialogFrame
      open={open}
      onOpenChange={(next) => {
        if (busy) return
        onOpenChange(next)
      }}
      title={t('taxi_fleet.platformSync.import.title', 'Import platform trips (CSV)')}
      contentRef={dialogContentRef}
      onKeyDown={onKeyDown}
    >
      <TaxiFleetDialogForm
        onSubmit={(event) => void handleSubmit(event)}
        body={
          <div className={taxiFleetDialogScrollBodyClass}>
            <p className="text-sm text-muted-foreground">
              {t(
                'taxi_fleet.platformSync.import.hint',
                'Upload a CSV export from Bolt, Uber, or Free. Rows map drivers via platform IDs on driver profiles.',
              )}
            </p>
            <div className="space-y-2">
              <label htmlFor="platform-sync-platform" className="text-sm font-medium">
                {t('taxi_fleet.platformSync.import.platform', 'Platform')}
              </label>
              <select
                id="platform-sync-platform"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={platform}
                disabled={busy}
                onChange={(event) => setPlatform(event.target.value)}
              >
                {TAXI_FLEET_TRIP_PLATFORMS.map((value) => (
                  <option key={value} value={value}>
                    {t(`taxi_fleet.trips.platforms.${value}`, value)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="platform-sync-file" className="text-sm font-medium">
                {t('taxi_fleet.platformSync.import.file', 'CSV file')}
              </label>
              <input
                ref={fileInputRef}
                id="platform-sync-file"
                type="file"
                accept=".csv,text/csv,text/plain"
                disabled={busy}
                className="block w-full text-sm"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
          </div>
        }
        footer={
          <div className={taxiFleetDialogFooterClass}>
            <Button type="button" variant="outline" disabled={busy} onClick={handleCancel}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={!canSubmit} className="inline-flex items-center gap-2">
              <Upload className="size-4" aria-hidden />
              {busy
                ? t('taxi_fleet.platformSync.import.submitting', 'Importing…')
                : t('taxi_fleet.platformSync.import.submit', 'Import CSV')}
            </Button>
          </div>
        }
      />
    </TaxiFleetDialogFrame>
  )
}
