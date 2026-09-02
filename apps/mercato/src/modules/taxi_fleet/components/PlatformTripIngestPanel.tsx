'use client'

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { readTripIngestSource } from '../lib/platformSync/platformTripIngest'

type PlatformTripIngestPanelProps = {
  metadata?: Record<string, unknown> | null
  platform?: string | null
  externalTripId?: string | null
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

function FieldRow(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{props.label}</div>
      <div className="text-sm break-all">{props.children}</div>
    </div>
  )
}

export function PlatformTripIngestPanel({
  metadata,
  platform,
  externalTripId,
}: PlatformTripIngestPanelProps) {
  const t = useT()
  const ingestSource = readTripIngestSource(metadata ?? null)
  const platformKey = typeof platform === 'string' ? platform.trim().toLowerCase() : ''
  const platformLabel = platformKey
    ? t(`taxi_fleet.trips.platforms.${platformKey}`, platformKey)
    : t('taxi_fleet.trips.platforms.none', 'None')
  const ingestLabel =
    ingestSource === 'platform_csv'
      ? t('taxi_fleet.platformSync.badge.csv', 'Platform CSV')
      : ingestSource === 'platform_sync'
        ? t('taxi_fleet.platformSync.badge.sync', 'Platform sync')
        : t('taxi_fleet.platformSync.ingest.sourceUnknown', 'Unknown')
  const platformDriverId = readMetadataString(metadata, 'platformDriverId')
  const lastSyncedAt = readMetadataString(metadata, 'lastSyncedAt')
  const platformVehicleId = readMetadataString(metadata, 'platformVehicleId')
  const vehiclePlate = readMetadataString(metadata, 'vehiclePlate')

  return (
    <section className="rounded-lg border bg-card px-4 py-3 space-y-3">
      <h2 className="text-sm font-semibold">
        {t('taxi_fleet.platformSync.ingest.title', 'Platform ingest')}
      </h2>
      <FieldRow label={t('taxi_fleet.platformSync.import.platform', 'Platform')}>
        <Badge variant={platformKey ? 'outline' : 'secondary'}>{platformLabel}</Badge>
      </FieldRow>
      <FieldRow label={t('taxi_fleet.platformSync.ingest.source', 'Source')}>
        <Badge variant="secondary">{ingestLabel}</Badge>
      </FieldRow>
      <FieldRow label={t('taxi_fleet.platformSync.ingest.externalId', 'External trip ID')}>
        {externalTripId?.trim() || '—'}
      </FieldRow>
      <FieldRow label={t('taxi_fleet.platformSync.ingest.driverId', 'Platform driver ID')}>
        {platformDriverId || '—'}
      </FieldRow>
      {platformVehicleId ? (
        <FieldRow label={t('taxi_fleet.platformSync.ingest.vehicleId', 'Platform vehicle ID')}>
          {platformVehicleId}
        </FieldRow>
      ) : null}
      {vehiclePlate ? (
        <FieldRow label={t('taxi_fleet.platformSync.ingest.vehiclePlate', 'License plate')}>
          {vehiclePlate}
        </FieldRow>
      ) : null}
      <FieldRow label={t('taxi_fleet.platformSync.ingest.lastSynced', 'Last synced')}>
        {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : '—'}
      </FieldRow>
    </section>
  )
}
