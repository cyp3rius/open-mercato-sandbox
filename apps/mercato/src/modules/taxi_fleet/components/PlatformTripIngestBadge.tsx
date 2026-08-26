"use client"

import * as React from 'react'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { readTripIngestSource } from '../lib/platformSync/platformTripIngest'

type PlatformTripIngestBadgeProps = {
  metadata?: Record<string, unknown> | null
  platform?: string | null
  externalTripId?: string | null
}

export function PlatformTripIngestBadge({ metadata, platform, externalTripId }: PlatformTripIngestBadgeProps) {
  const t = useT()
  const ingestSource = readTripIngestSource(metadata ?? null)
  if (!ingestSource) return null

  const label =
    ingestSource === 'platform_csv'
      ? t('taxi_fleet.platformSync.badge.csv', 'Platform CSV')
      : t('taxi_fleet.platformSync.badge.sync', 'Platform sync')

  const platformLabel = platform
    ? t(`taxi_fleet.trips.platforms.${platform}`, platform)
    : null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="secondary">{label}</Badge>
      {platformLabel ? (
        <Badge variant="outline">{platformLabel}</Badge>
      ) : null}
      {externalTripId ? (
        <span className="text-xs text-muted-foreground">{externalTripId}</span>
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
