'use client'

import * as React from 'react'
import type { ScheduleItem } from '@open-mercato/ui/backend/schedule'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { resolveStableDriverColor } from '../lib/calendarScheduleItems'

const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type FleetCalendarDriverLegendEntry = {
  teamMemberId: string
  label: string
  color: string
}

function readDisplayLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed.length || UUID_LIKE.test(trimmed)) return null
  return trimmed
}

export function buildFleetCalendarDriverLegendEntries(
  items: ScheduleItem[],
  resolveDriverName: (teamMemberId: string) => string,
  unassignedLabel: string,
  unknownDriverLabel: string,
): FleetCalendarDriverLegendEntry[] {
  const byId = new Map<string, FleetCalendarDriverLegendEntry>()
  let hasUnassigned = false

  for (const item of items) {
    const teamMemberId = typeof item.subjectId === 'string' ? item.subjectId.trim() : ''
    if (!teamMemberId) {
      hasUnassigned = true
      continue
    }
    if (byId.has(teamMemberId)) continue
    const fromMetadata = readDisplayLabel(item.metadata?.driverName)
    const resolved = readDisplayLabel(resolveDriverName(teamMemberId))
    const label = fromMetadata ?? resolved ?? unknownDriverLabel
    byId.set(teamMemberId, {
      teamMemberId,
      label,
      color: resolveStableDriverColor(teamMemberId),
    })
  }

  const entries = [...byId.values()].sort((left, right) =>
    left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }),
  )

  if (hasUnassigned) {
    entries.push({
      teamMemberId: '__unassigned__',
      label: unassignedLabel,
      color: '#64748b',
    })
  }

  return entries
}

type FleetCalendarDriverLegendProps = {
  entries: FleetCalendarDriverLegendEntry[]
  className?: string
}

export function FleetCalendarDriverLegend({ entries, className }: FleetCalendarDriverLegendProps) {
  const t = useT()
  if (!entries.length) return null

  return (
    <div
      className={[
        'shrink-0 rounded-xl border bg-card px-3 py-2',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">
        {t('taxi_fleet.calendar.driverLegend', 'Drivers')}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
        {entries.map((entry) => (
          <li key={entry.teamMemberId} className="inline-flex max-w-full items-center gap-1.5 text-xs">
            <span
              className="size-2.5 shrink-0 rounded-sm border border-black/10"
              style={{ backgroundColor: entry.color }}
              aria-hidden
            />
            <span className="min-w-0 truncate text-foreground">{entry.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
