'use client'

import * as React from 'react'
import { Button } from '@open-mercato/ui/primitives/button'
import { cn } from '@open-mercato/shared/lib/utils'
import { usePlaybookFormTab } from './PlaybookFormTabContext'
import type { PlaybookFormTranslator } from './playbookFormConfig'

export function buildPlaybookFormTabList(t: PlaybookFormTranslator) {
  return function PlaybookFormTabList() {
    const { activeTab, setActiveTab } = usePlaybookFormTab()
    const tabs = React.useMemo(
      () => [
        { id: 'details' as const, label: t('playbooks.form.tabDetails', 'Details') },
        { id: 'steps' as const, label: t('playbooks.form.tabSteps', 'Steps') },
      ],
      [t],
    )
    return (
      <nav
        className={cn(
          'inline-flex w-fit max-w-full flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1 text-sm text-muted-foreground',
        )}
        role="tablist"
        aria-label={t('playbooks.form.tabsNav', 'Playbook sections')}
      >
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            type="button"
            variant="ghost"
            size="sm"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
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
}
