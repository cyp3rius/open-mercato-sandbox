'use client'

import * as React from 'react'
import { cn } from '@open-mercato/shared/lib/utils'

export type PlaybookFormTabId = 'details' | 'steps'

type PlaybookFormTabContextValue = {
  activeTab: PlaybookFormTabId
  setActiveTab: (next: PlaybookFormTabId) => void
}

const PlaybookFormTabContext = React.createContext<PlaybookFormTabContextValue | null>(null)

export function PlaybookFormTabProvider({
  children,
  defaultTab = 'details',
}: {
  children: React.ReactNode
  defaultTab?: PlaybookFormTabId
}) {
  const [activeTab, setActiveTab] = React.useState<PlaybookFormTabId>(defaultTab)
  const value = React.useMemo(() => ({ activeTab, setActiveTab }), [activeTab])
  return (
    <PlaybookFormTabContext.Provider value={value}>
      <div
        className={cn(
          activeTab === 'steps' &&
            '[&_[data-crud-field-id=titleSlugRow]]:hidden [&_[data-crud-field-id=body]]:hidden',
          activeTab === 'details' && '[&_[data-crud-field-id=procedureDefinition]]:hidden',
        )}
      >
        {children}
      </div>
    </PlaybookFormTabContext.Provider>
  )
}

export function usePlaybookFormTab(): PlaybookFormTabContextValue {
  const ctx = React.useContext(PlaybookFormTabContext)
  if (!ctx) {
    throw new Error('PlaybookFormTabProvider is required')
  }
  return ctx
}

export function usePlaybookFormTabOptional(): PlaybookFormTabContextValue | null {
  return React.useContext(PlaybookFormTabContext)
}
