'use client'

import * as React from 'react'
import { Button } from '@open-mercato/ui/primitives/button'
import { cn } from '@open-mercato/shared/lib/utils'

export type DetailTabDefinition<TId extends string = string> = {
  id: TId
  label: React.ReactNode
  icon?: React.ReactNode
}

type DetailTabsLayoutProps<TId extends string = string> = {
  tabs: DetailTabDefinition<TId>[]
  activeTab: TId
  onTabChange: (id: TId) => void
  navAriaLabel: string
  className?: string
  headerClassName?: string
  navClassName?: string
  /** When set, remounts the panel when the key changes (avoids React 19 + DevTools reconciliation warnings when swapping tab bodies). */
  panelContentKey?: React.Key
  children: React.ReactNode
}

export function DetailTabsLayout<TId extends string = string>({
  tabs,
  activeTab,
  onTabChange,
  navAriaLabel,
  className,
  headerClassName,
  navClassName,
  panelContentKey,
  children,
}: DetailTabsLayoutProps<TId>) {
  const handleTabChange = React.useCallback(
    (id: TId) => {
      onTabChange(id)
    },
    [onTabChange],
  )

  return (
    <div className={cn('space-y-4', className)}>
      <div className={cn('flex flex-wrap items-center gap-3', headerClassName)}>
        <nav
          className={cn(
            'inline-flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1 text-sm text-muted-foreground',
            navClassName,
          )}
          role="tablist"
          aria-label={navAriaLabel}
        >
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              type="button"
              variant="ghost"
              size="sm"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                'h-8 shrink-0 rounded-md px-3 font-medium shadow-none',
                activeTab === tab.id
                  ? 'bg-background text-foreground shadow-sm hover:bg-background'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                {tab.icon}
                {tab.label}
              </span>
            </Button>
          ))}
        </nav>
      </div>
      <div key={panelContentKey ?? 'detail-tab-panel'}>{children}</div>
    </div>
  )
}
