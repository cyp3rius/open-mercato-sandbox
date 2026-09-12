"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { cn } from '@open-mercato/shared/lib/utils'

export const TRIP_FORM_TAB_IDS = ['route', 'details', 'assignment', 'customer'] as const
export type TripFormTabId = (typeof TRIP_FORM_TAB_IDS)[number]

export function tripFormTabGroupId(tab: TripFormTabId): string {
  return `trip-tab-${tab}`
}

type TripFormTabNavProps = {
  activeTab: TripFormTabId
  onTabChange: (tab: TripFormTabId) => void
  className?: string
}

export function TripFormTabNav({ activeTab, onTabChange, className }: TripFormTabNavProps) {
  const t = useT()
  const tabs: Array<{ id: TripFormTabId; label: string }> = [
    { id: 'route', label: t('taxi_fleet.trips.form.tabs.route', 'Route') },
    { id: 'details', label: t('taxi_fleet.trips.form.tabs.details', 'Trip details') },
    { id: 'assignment', label: t('taxi_fleet.trips.form.tabs.assignment', 'Assignment') },
    { id: 'customer', label: t('taxi_fleet.trips.form.tabs.customer', 'Customer & billing') },
  ]

  return (
    <nav
      className={cn(
        'inline-flex w-full flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1 text-sm text-muted-foreground',
        className,
      )}
      role="tablist"
      aria-label={t('taxi_fleet.trips.form.tabs.ariaLabel', 'Trip form sections')}
    >
      {tabs.map((tab) => (
        <Button
          key={tab.id}
          type="button"
          variant="ghost"
          size="sm"
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'h-8 shrink-0 rounded-md px-3 font-medium shadow-none',
            activeTab === tab.id
              ? 'bg-background text-foreground shadow-sm hover:bg-background'
              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
          )}
        >
          {tab.label}
        </Button>
      ))}
    </nav>
  )
}
