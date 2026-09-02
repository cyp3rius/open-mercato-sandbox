'use client'

import * as React from 'react'
import { FileSpreadsheet, History, Upload } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { Button } from '@open-mercato/ui/primitives/button'
import { Label } from '@open-mercato/ui/primitives/label'
import { CRUD_FORM_SELECT_CLASS } from '@open-mercato/ui/backend/CrudForm'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import {
  TaxiFleetDialogForm,
  TaxiFleetDialogFrame,
  useTaxiFleetDialogShortcuts,
} from './TaxiFleetDialogShell'
import { PlatformSyncRunsPanel } from './PlatformSyncRunsPanel'
import {
  formatPlatformSyncImportFlashMessage,
  resolvePlatformSyncFlashVariant,
} from './platformSyncResultSummary'
import { TAXI_FLEET_TRIP_PLATFORMS } from '../lib/tripPlatforms'
import { uberFleetCsvFilenameRangesMatch } from '../lib/platformSync/uberFleetCsvFilename'

type PlatformSyncImportCsvDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported?: () => void
}

type ImportResult = {
  runId?: string
  status?: string
  createdCount?: number
  duplicateCount?: number
  skippedCount?: number
  unmappedDriverSkippedCount?: number
  errorCount?: number
}

function CsvFileField(props: {
  id: string
  label: string
  description: string
  file: File | null
  disabled: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
  onChange: (file: File | null) => void
  emptyHint: string
  chooseLabel: string
  changeLabel: string
  clearLabel: string
}) {
  return (
    <div className="space-y-3 rounded-md border border-border/70 bg-muted/15 p-4">
      <div className="space-y-1">
        <Label htmlFor={props.id} className="text-sm font-medium">
          {props.label}
        </Label>
        <p className="text-xs leading-relaxed text-muted-foreground">{props.description}</p>
      </div>
      <input
        ref={props.inputRef}
        id={props.id}
        type="file"
        accept=".csv,text/csv,text/plain"
        disabled={props.disabled}
        className="sr-only"
        onChange={(event) => props.onChange(event.target.files?.[0] ?? null)}
      />
      {props.file ? (
        <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-2">
          <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm">{props.file.name}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={props.disabled}
            onClick={() => props.inputRef.current?.click()}
          >
            {props.changeLabel}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={props.disabled}
            onClick={() => {
              props.onChange(null)
              if (props.inputRef.current) props.inputRef.current.value = ''
            }}
          >
            {props.clearLabel}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="inline-flex items-center gap-2"
            disabled={props.disabled}
            onClick={() => props.inputRef.current?.click()}
          >
            <Upload className="size-4 shrink-0" aria-hidden />
            {props.chooseLabel}
          </Button>
          <span className="text-xs text-muted-foreground">{props.emptyHint}</span>
        </div>
      )}
    </div>
  )
}

export function PlatformSyncImportCsvDialog({
  open,
  onOpenChange,
  onImported,
}: PlatformSyncImportCsvDialogProps) {
  const t = useT()
  const { organizationId } = useOrganizationScopeDetail()
  const contentRef = React.useRef<HTMLDivElement>(null)
  const historyContentRef = React.useRef<HTMLDivElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const tripActivityInputRef = React.useRef<HTMLInputElement | null>(null)
  const paymentsInputRef = React.useRef<HTMLInputElement | null>(null)
  const [platform, setPlatform] = React.useState('bolt')
  const [file, setFile] = React.useState<File | null>(null)
  const [tripActivityFile, setTripActivityFile] = React.useState<File | null>(null)
  const [paymentsFile, setPaymentsFile] = React.useState<File | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const [historyReloadToken, setHistoryReloadToken] = React.useState(0)
  const isUber = platform === 'uber'
  const isBolt = platform === 'bolt'

  const resetFiles = React.useCallback(() => {
    setFile(null)
    setTripActivityFile(null)
    setPaymentsFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (tripActivityInputRef.current) tripActivityInputRef.current.value = ''
    if (paymentsInputRef.current) paymentsInputRef.current.value = ''
  }, [])

  React.useEffect(() => {
    if (!open) return
    setPlatform('bolt')
    setBusy(false)
    resetFiles()
  }, [open, resetFiles])

  React.useEffect(() => {
    resetFiles()
  }, [platform, resetFiles])

  React.useEffect(() => {
    if (!historyOpen) return
    setHistoryReloadToken((value) => value + 1)
    const timer = window.setInterval(() => {
      setHistoryReloadToken((value) => value + 1)
    }, 4000)
    return () => window.clearInterval(timer)
  }, [historyOpen])

  const dateRangeError = React.useMemo(() => {
    if (!isUber || !tripActivityFile || !paymentsFile) return null
    const check = uberFleetCsvFilenameRangesMatch(tripActivityFile.name, paymentsFile.name)
    if (check.ok) return null
    return t(
      'taxi_fleet.platformSync.import.dateRangeMismatch',
      'Trip Activity and Payments files cover different date ranges ({left} vs {right}). Export both for the same period.',
      {
        left: `${check.left.from}-${check.left.to}`,
        right: `${check.right.from}-${check.right.to}`,
      },
    )
  }, [isUber, paymentsFile, t, tripActivityFile])

  const canSubmit = Boolean(
    organizationId &&
      platform &&
      !busy &&
      !dateRangeError &&
      (isUber ? tripActivityFile && paymentsFile : file),
  )

  const handleCancel = React.useCallback(() => {
    if (busy) return
    onOpenChange(false)
  }, [busy, onOpenChange])

  const handleSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!canSubmit) return
      if (dateRangeError) {
        flash(dateRangeError, 'error')
        return
      }
      setBusy(true)
      const form = new FormData()
      form.set('platform', platform)
      if (isUber) {
        if (!tripActivityFile || !paymentsFile) {
          setBusy(false)
          return
        }
        form.set('tripActivityFile', tripActivityFile)
        form.set('paymentsFile', paymentsFile)
      } else if (file) {
        form.set('file', file)
      } else {
        setBusy(false)
        return
      }

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
      const result = call.result as ImportResult | null
      if (call.status === 202 || result?.status === 'queued') {
        flash(
          t(
            'taxi_fleet.platformSync.import.queued',
            'Import started. You will be notified when it finishes.',
          ),
          'success',
        )
      } else {
        const counts = {
          createdCount: result?.createdCount ?? 0,
          duplicateCount: result?.duplicateCount ?? 0,
          skippedCount: result?.skippedCount ?? 0,
          unmappedDriverSkippedCount: result?.unmappedDriverSkippedCount ?? 0,
          errorCount: result?.errorCount ?? 0,
        }
        flash(formatPlatformSyncImportFlashMessage(counts, t), resolvePlatformSyncFlashVariant(counts))
      }
      onOpenChange(false)
      setHistoryOpen(true)
      setHistoryReloadToken((value) => value + 1)
      onImported?.()
    },
    [
      canSubmit,
      dateRangeError,
      file,
      isUber,
      onImported,
      onOpenChange,
      paymentsFile,
      platform,
      t,
      tripActivityFile,
    ],
  )

  const onKeyDown = useTaxiFleetDialogShortcuts({
    contentRef,
    onCancel: handleCancel,
    canSubmit,
  })

  return (
    <>
      <TaxiFleetDialogFrame
        open={open}
        onOpenChange={(next) => {
          if (busy) return
          onOpenChange(next)
        }}
        title={t('taxi_fleet.platformSync.import.title', 'Import platform trips (CSV)')}
        size="lg"
        contentRef={contentRef}
        onKeyDown={onKeyDown}
      >
        <TaxiFleetDialogForm
          onSubmit={(event) => void handleSubmit(event)}
          body={
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {isUber
                  ? t(
                      'taxi_fleet.platformSync.import.hintUber',
                      'Uber requires two Fleet reports. Only trips whose Driver UUID matches a CRM driver profile uberDriverId are imported. Existing trips (same platform ID) are skipped as duplicates.',
                    )
                  : isBolt
                    ? t(
                        'taxi_fleet.platformSync.import.hintBolt',
                        'Upload Bolt Fleet portal “Trip history” (PL: Historia przejazdów). Only completed trips (Ukończone) are imported. Set Bolt driver ID on profiles to the portal “Indywidualny numer identyfikacyjny”.',
                      )
                    : t(
                        'taxi_fleet.platformSync.import.hintFree',
                        'Upload a generic Free fleet CSV (externalTripId, platformDriverId, startedAt, revenueAmount). Only trips whose platformDriverId matches a CRM driver profile freeDriverId are imported. Existing trips are skipped as duplicates.',
                      )}
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="platform-sync-platform" className="text-sm font-medium">
                  {t('taxi_fleet.platformSync.import.platform', 'Platform')}
                </Label>
                <select
                  id="platform-sync-platform"
                  className={CRUD_FORM_SELECT_CLASS}
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

              {isUber ? (
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t('taxi_fleet.platformSync.import.uberFilesHeading', 'Required Uber files')}
                  </p>
                  <CsvFileField
                    id="platform-sync-trip-activity"
                    label={t(
                      'taxi_fleet.platformSync.import.tripActivityFile',
                      '1. Trip Activity',
                    )}
                    description={t(
                      'taxi_fleet.platformSync.import.tripActivityFileHint',
                      'Fleet report “Trip activity” (PL: Aktywność przejazdów) — trip UUIDs, drivers, times, distance, status.',
                    )}
                    file={tripActivityFile}
                    disabled={busy}
                    inputRef={tripActivityInputRef}
                    onChange={setTripActivityFile}
                    emptyHint={t(
                      'taxi_fleet.platformSync.import.fileEmpty',
                      'No file selected',
                    )}
                    chooseLabel={t('taxi_fleet.platformSync.import.chooseFile', 'Choose CSV')}
                    changeLabel={t('taxi_fleet.platformSync.import.changeFile', 'Change')}
                    clearLabel={t('common.clear', 'Clear')}
                  />
                  <CsvFileField
                    id="platform-sync-payments"
                    label={t(
                      'taxi_fleet.platformSync.import.paymentsFile',
                      '2. Payment transactions',
                    )}
                    description={t(
                      'taxi_fleet.platformSync.import.paymentsFileHint',
                      'Fleet report “Payment transactions” / “Payments order” (PL: Transakcje płatności) — revenue per trip UUID.',
                    )}
                    file={paymentsFile}
                    disabled={busy}
                    inputRef={paymentsInputRef}
                    onChange={setPaymentsFile}
                    emptyHint={t(
                      'taxi_fleet.platformSync.import.fileEmpty',
                      'No file selected',
                    )}
                    chooseLabel={t('taxi_fleet.platformSync.import.chooseFile', 'Choose CSV')}
                    changeLabel={t('taxi_fleet.platformSync.import.changeFile', 'Change')}
                    clearLabel={t('common.clear', 'Clear')}
                  />
                  {dateRangeError ? (
                    <p className="text-sm text-destructive">{dateRangeError}</p>
                  ) : null}
                </div>
              ) : (
                <CsvFileField
                  id="platform-sync-file"
                  label={
                    isBolt
                      ? t(
                          'taxi_fleet.platformSync.import.boltFile',
                          'Trip history CSV (Historia przejazdów)',
                        )
                      : t('taxi_fleet.platformSync.import.file', 'CSV file')
                  }
                  description={
                    isBolt
                      ? t(
                          'taxi_fleet.platformSync.import.fileHintBolt',
                          'Bolt Fleet portal export. Only rows with status “Ukończone” are imported.',
                        )
                      : t(
                          'taxi_fleet.platformSync.import.fileHint',
                          'Generic platform CSV with externalTripId, platformDriverId, startedAt, revenueAmount.',
                        )
                  }
                  file={file}
                  disabled={busy}
                  inputRef={fileInputRef}
                  onChange={setFile}
                  emptyHint={t(
                    'taxi_fleet.platformSync.import.fileEmpty',
                    'No file selected',
                  )}
                  chooseLabel={t('taxi_fleet.platformSync.import.chooseFile', 'Choose CSV')}
                  changeLabel={t('taxi_fleet.platformSync.import.changeFile', 'Change')}
                  clearLabel={t('common.clear', 'Clear')}
                />
              )}
            </div>
          }
          footer={
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                className="inline-flex items-center gap-2"
                disabled={busy}
                onClick={() => setHistoryOpen(true)}
              >
                <History className="size-4" aria-hidden />
                {t('taxi_fleet.platformSync.import.history', 'History')}
              </Button>
              <div className="flex flex-wrap items-center gap-2">
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
            </div>
          }
        />
      </TaxiFleetDialogFrame>

      <TaxiFleetDialogFrame
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        title={t('taxi_fleet.platformSync.runs.title', 'Recent platform sync runs')}
        size="2xl"
        contentRef={historyContentRef}
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <PlatformSyncRunsPanel reloadToken={historyReloadToken} pollActive />
        </div>
        <div className="flex shrink-0 justify-end border-t border-border/60 bg-background px-6 py-4">
          <Button type="button" variant="outline" onClick={() => setHistoryOpen(false)}>
            {t('common.close', 'Close')}
          </Button>
        </div>
      </TaxiFleetDialogFrame>
    </>
  )
}
