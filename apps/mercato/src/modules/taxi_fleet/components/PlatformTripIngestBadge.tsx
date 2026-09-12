'use client'

import * as React from 'react'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { readTripIngestSource } from '../lib/platformSync/platformTripIngest'

type PlatformTripIngestBadgeProps = {
  metadata?: Record<string, unknown> | null
  platform?: string | null
  externalTripId?: string | null
  /** compact = platform name only (list); detail = source + ids (detail header) */
  variant?: 'compact' | 'detail'
}

function readMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  if (!metadata || typeof metadata !== 'object') return null
  const value = metadata[key]
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

export function PlatformTripIngestBadge({
  metadata,
  platform,
  externalTripId,
  variant = 'compact',
}: PlatformTripIngestBadgeProps) {
  const t = useT()
  const ingestSource = readTripIngestSource(metadata ?? null)
  const platformKey = typeof platform === 'string' ? platform.trim().toLowerCase() : ''
  const platformLabel = platformKey
    ? t(`taxi_fleet.trips.platforms.${platformKey}`, platformKey)
    : t('taxi_fleet.trips.platforms.none', 'None')

  if (variant === 'compact') {
    return (
      <Badge variant={platformKey ? 'outline' : 'secondary'}>{platformLabel}</Badge>
    )
  }

  const ingestLabel =
    ingestSource === 'platform_csv'
      ? t('taxi_fleet.platformSync.badge.csv', 'Platform CSV')
      : ingestSource === 'platform_sync'
        ? t('taxi_fleet.platformSync.badge.sync', 'Platform sync')
        : null
  const platformDriverId = readMetadataString(metadata, 'platformDriverId')
  const lastSyncedAt = readMetadataString(metadata, 'lastSyncedAt')

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant={platformKey ? 'outline' : 'secondary'}>{platformLabel}</Badge>
      {ingestLabel ? <Badge variant="secondary">{ingestLabel}</Badge> : null}
      {externalTripId ? (
        <span className="text-xs text-muted-foreground">{externalTripId}</span>
      ) : null}
      {platformDriverId ? (
        <span className="text-xs text-muted-foreground">
          {t('taxi_fleet.platformSync.ingest.driverId', 'Driver ID')}: {platformDriverId}
        </span>
      ) : null}
      {lastSyncedAt ? (
        <span className="text-xs text-muted-foreground">
          {t('taxi_fleet.platformSync.ingest.lastSynced', 'Last synced')}:{' '}
          {new Date(lastSyncedAt).toLocaleString()}
        </span>
      ) : null}
    </div>
  )
}

export function readPlatformTripIngestLabel(
  metadata: Record<string, unknown> | null | undefined,
  t: (key: string, fallback: string) => string,
): string | null {
  const ingestSource = readTripIngestSource(metadata)
  if (!ingestSource) return null
  return ingestSource === 'platform_csv'
    ? t('taxi_fleet.platformSync.badge.csv', 'Platform CSV')
    : t('taxi_fleet.platformSync.badge.sync', 'Platform sync')
}
