import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { PlatformTripIngestSource } from './types'

const PLATFORM_INGEST_SOURCES = new Set<PlatformTripIngestSource>(['platform_sync', 'platform_csv'])

export function readTripIngestSource(
  metadata: Record<string, unknown> | null | undefined,
): PlatformTripIngestSource | null {
  if (!metadata || typeof metadata !== 'object') return null
  const value = metadata.ingestSource
  if (value === 'platform_sync' || value === 'platform_csv') return value
  return null
}

export function isPlatformIngestedTrip(metadata: Record<string, unknown> | null | undefined): boolean {
  const source = readTripIngestSource(metadata)
  return source != null && PLATFORM_INGEST_SOURCES.has(source)
}

export function assertDriverCanMutatePlatformTrip(
  metadata: Record<string, unknown> | null | undefined,
  translate: (key: string, fallback: string) => string,
): void {
  if (!isPlatformIngestedTrip(metadata)) return
  throw new CrudHttpError(403, {
    error: translate(
      'taxi_fleet.platformSync.driverReadOnly',
      'This trip was imported from a platform app and cannot be edited in the driver app.',
    ),
  })
}
