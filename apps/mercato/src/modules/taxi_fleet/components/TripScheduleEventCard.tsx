"use client"

import * as React from 'react'
import type { ScheduleItem } from '@open-mercato/ui/backend/schedule'
import { renderDictionarySourceIcon } from '@open-mercato/core/modules/dictionaries/components/dictionaryAppearance'
import { useTripStatusDictionary } from './useTripStatusDictionary'

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length ? value.trim() : null
}

export function TripScheduleEventCard({ item }: { item: ScheduleItem }) {
  const { findDefinition } = useTripStatusDictionary()
  const metadata = item.metadata ?? {}
  const driverName = readString(metadata.driverName) ?? item.title
  const omitDriver = metadata.omitDriverInTitle === true
  const tripStatus = readString(metadata.tripStatus)
  const definition = tripStatus ? findDefinition(tripStatus) : undefined
  const statusColor = definition?.color?.trim() || undefined

  return (
    <div className="relative h-full min-h-0 overflow-visible text-[10px] leading-tight text-foreground">
      {definition ? (
        <span
          className="absolute -right-0.5 -top-1 z-10 inline-flex max-w-[75%] items-center gap-1 rounded-full border bg-white px-1.5 py-0.5 text-[9px] leading-none text-black shadow-sm"
          style={statusColor ? { borderColor: statusColor } : undefined}
        >
          {statusColor ? (
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: statusColor }}
              aria-hidden
            />
          ) : null}
          {definition.icon?.trim() ? (
            <span className="inline-flex size-3 shrink-0 items-center justify-center text-black [&_svg]:size-3">
              {renderDictionarySourceIcon(definition.icon, 'size-3 text-black')}
            </span>
          ) : null}
          <span className="min-w-0 truncate text-black">{definition.label}</span>
        </span>
      ) : null}

      {!omitDriver ? (
        <div className={`truncate font-bold ${definition ? 'pr-[4.75rem]' : ''}`}>
          {driverName}
        </div>
      ) : null}
    </div>
  )
}
