'use client'

import * as React from 'react'
import { format } from 'date-fns'
import type { ScheduleItem } from '@open-mercato/ui/backend/schedule'
import { renderDictionarySourceIcon } from '@open-mercato/core/modules/dictionaries/components/dictionaryAppearance'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useTripStatusDictionary } from './useTripStatusDictionary'

const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function readDisplayLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed.length || UUID_LIKE.test(trimmed)) return null
  return trimmed
}

function formatEventTimeRange(item: ScheduleItem): string {
  return `${format(item.startsAt, 'HH:mm')}–${format(item.endsAt, 'HH:mm')}`
}

function eventDurationMinutes(item: ScheduleItem): number {
  return Math.max(0, (item.endsAt.getTime() - item.startsAt.getTime()) / 60_000)
}

function TripStatusChip({
  label,
  color,
  icon,
  compact,
}: {
  label: string
  color?: string
  icon?: string | null
  compact?: boolean
}) {
  return (
    <span
      className={`inline-flex max-w-full shrink-0 items-center gap-0.5 rounded border bg-background/90 ${
        compact ? 'px-1 py-px text-[8px]' : 'px-1 py-0.5 text-[9px]'
      } leading-none`}
      style={color ? { borderColor: color } : undefined}
    >
      {color ? (
        <span
          className="size-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
      ) : null}
      {!compact && icon?.trim() ? (
        <span className="inline-flex size-2.5 shrink-0 items-center justify-center [&_svg]:size-2.5">
          {renderDictionarySourceIcon(icon, 'size-2.5')}
        </span>
      ) : null}
      <span className="min-w-0 truncate">{label}</span>
    </span>
  )
}

export function TripScheduleEventCard({ item }: { item: ScheduleItem }) {
  const t = useT()
  const { findDefinition } = useTripStatusDictionary()
  const metadata = item.metadata ?? {}
  const driverName = readDisplayLabel(metadata.driverName)
  const vehicleLabel = readDisplayLabel(metadata.vehicleLabel)
  const routeSummary = readDisplayLabel(metadata.routeSummary)
  const fromAddress = readDisplayLabel(metadata.fromAddress)
  const toAddress = readDisplayLabel(metadata.toAddress)
  const platformRaw = typeof metadata.platform === 'string' ? metadata.platform.trim() : null
  const platform = platformRaw && !UUID_LIKE.test(platformRaw) ? platformRaw : null
  const omitDriver = metadata.omitDriverInTitle === true
  const tripStatus = typeof metadata.tripStatus === 'string' ? metadata.tripStatus.trim() : null
  const definition = tripStatus ? findDefinition(tripStatus) : undefined
  const statusColor = definition?.color?.trim() || undefined
  const minutes = eventDurationMinutes(item)
  const compact = minutes < 50
  const routeLine =
    routeSummary ||
    (fromAddress && toAddress ? `${fromAddress} → ${toAddress}` : fromAddress || toAddress)
  const primaryLine = omitDriver ? vehicleLabel : driverName
  const secondaryLine = omitDriver
    ? routeLine
    : vehicleLabel

  return (
    <div className="flex h-full min-h-0 flex-col gap-0.5 overflow-hidden text-[10px] leading-tight text-foreground">
      <div className="flex min-w-0 items-start justify-between gap-1">
        <div className="min-w-0 truncate font-semibold tabular-nums">
          {formatEventTimeRange(item)}
        </div>
        {definition ? (
          <TripStatusChip
            label={definition.label}
            color={statusColor}
            icon={definition.icon}
            compact={compact}
          />
        ) : null}
      </div>

      {!compact && primaryLine ? (
        <div className="truncate font-medium">{primaryLine}</div>
      ) : null}

      {!compact && secondaryLine && secondaryLine !== primaryLine ? (
        <div className="truncate text-muted-foreground">{secondaryLine}</div>
      ) : null}

      {!compact && routeLine && routeLine !== secondaryLine && routeLine !== primaryLine ? (
        <div className="line-clamp-1 text-muted-foreground">{routeLine}</div>
      ) : null}

      {compact && (primaryLine || secondaryLine || routeLine) ? (
        <div className="truncate text-muted-foreground">
          {primaryLine || secondaryLine || routeLine}
        </div>
      ) : null}

      {!compact && platform ? (
        <div className="truncate uppercase tracking-wide text-muted-foreground/80">
          {t(`taxi_fleet.trips.platforms.${platform}`, platform)}
        </div>
      ) : null}
    </div>
  )
}

export function AssignmentScheduleEventCard({ item }: { item: ScheduleItem }) {
  const t = useT()
  const metadata = item.metadata ?? {}
  const driverName = readDisplayLabel(metadata.driverName) ?? readDisplayLabel(item.title)
  const vehicleLabel = readDisplayLabel(metadata.vehicleLabel)
  const assignmentStatus =
    typeof metadata.assignmentStatus === 'string' ? metadata.assignmentStatus.trim() : null
  const minutes = eventDurationMinutes(item)
  const showDetails = minutes >= 90

  return (
    <div className="flex h-full min-h-0 flex-col gap-0.5 overflow-hidden text-[10px] leading-tight text-foreground">
      <div className="truncate font-semibold tabular-nums">{formatEventTimeRange(item)}</div>
      {driverName ? <div className="truncate font-medium">{driverName}</div> : null}
      {showDetails && vehicleLabel ? (
        <div className="truncate text-muted-foreground">{vehicleLabel}</div>
      ) : null}
      {showDetails && assignmentStatus ? (
        <div className="truncate text-muted-foreground/80">
          {t(`taxi_fleet.assignments.statuses.${assignmentStatus}`, assignmentStatus)}
        </div>
      ) : null}
    </div>
  )
}
