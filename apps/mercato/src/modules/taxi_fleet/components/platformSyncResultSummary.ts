export type PlatformSyncResultCounts = {
  createdCount?: number
  duplicateCount?: number
  upsertedCount?: number
  skippedCount?: number
  unmappedDriverSkippedCount?: number
  errorCount?: number
}

type TranslateFn = (
  key: string,
  fallback: string,
  variables?: Record<string, string | number>,
) => string

export function resolvePlatformSyncFlashVariant(
  counts: PlatformSyncResultCounts,
): 'success' | 'warning' | 'error' {
  const errors = counts.errorCount ?? 0
  const created = counts.createdCount ?? counts.upsertedCount ?? 0
  const unmapped = counts.unmappedDriverSkippedCount ?? 0
  const skipped = counts.skippedCount ?? 0
  if (errors > 0 && created === 0) return 'error'
  if (errors > 0 || skipped > 0 || unmapped > 0) return 'warning'
  return 'success'
}

export function formatPlatformSyncImportFlashMessage(
  counts: PlatformSyncResultCounts,
  t: TranslateFn,
): string {
  const created = counts.createdCount ?? 0
  const duplicates = counts.duplicateCount ?? 0
  const errors = counts.errorCount ?? 0
  const unmapped = counts.unmappedDriverSkippedCount ?? 0
  const base = t(
    'taxi_fleet.platformSync.import.completed',
    'Import finished: {created} created, {duplicates} duplicates, {errors} errors.',
    { created, duplicates, errors },
  )
  if (unmapped <= 0) return base
  return `${base} ${t(
    'taxi_fleet.platformSync.summary.unmappedDriversSkipped',
    '{count} trips skipped — no driver mapping in CRM.',
    { count: unmapped },
  )}`
}

export function formatPlatformSyncRunFlashMessage(
  counts: PlatformSyncResultCounts,
  t: TranslateFn,
): string {
  const upserted = counts.upsertedCount ?? counts.createdCount ?? 0
  const unmapped = counts.unmappedDriverSkippedCount ?? 0
  const errors = counts.errorCount ?? 0
  const base = t(
    'taxi_fleet.platformSync.run.completed',
    'Platform sync finished: {upserted} trips upserted, {errors} errors.',
    { upserted, errors },
  )
  if (unmapped <= 0) return base
  return `${base} ${t(
    'taxi_fleet.platformSync.summary.unmappedDriversSkipped',
    '{count} trips skipped — no driver mapping in CRM.',
    { count: unmapped },
  )}`
}
