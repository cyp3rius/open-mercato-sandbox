"use client"

import * as React from 'react'
import { Button } from '@open-mercato/ui/primitives/button'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import {
  renderDictionaryColor,
  renderDictionaryIcon,
} from '@open-mercato/core/modules/dictionaries/components/dictionaryAppearance'
import type { DictionaryOption } from '@open-mercato/core/modules/dictionaries/components/DictionaryEntrySelect'
import { fetchDictionaryOptionsByKey } from '../lib/fetchDictionaryOptionsByKey'
import { PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY } from '../lib/dictionaryKeys'

export type ProcurementStatusAdvanceTargets = {
  enforced: boolean
  items: { toStatusValue: string; toStatusLabel: string }[]
  terminalProcessStatusValue: string | null
}

export function resolveProcurementStatusPipelineMode(
  statusValue: string | null | undefined,
  statusAdvance: ProcurementStatusAdvanceTargets,
): 'terminal' | 'enforced' | 'editable' {
  const currentStatusTrimmed = typeof statusValue === 'string' ? statusValue.trim() : ''
  const terminalCfg = statusAdvance.terminalProcessStatusValue?.trim() ?? ''
  const atConfiguredTerminal = terminalCfg.length > 0 && currentStatusTrimmed === terminalCfg

  if (statusAdvance.enforced === true && (statusAdvance.items.length === 0 || atConfiguredTerminal)) {
    return 'terminal'
  }
  if (
    statusAdvance.enforced === true &&
    statusAdvance.items.length > 0 &&
    !atConfiguredTerminal
  ) {
    return 'enforced'
  }
  return 'editable'
}

export function ProcurementProcessStatusTransitionBar({
  statusAdvance,
  allowEdits,
  onAdvanceStatus,
}: {
  statusAdvance: ProcurementStatusAdvanceTargets
  allowEdits: boolean
  onAdvanceStatus: (toStatusValue: string) => void | Promise<void>
}) {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const [options, setOptions] = React.useState<DictionaryOption[]>([])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const rows = await fetchDictionaryOptionsByKey(PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY)
      if (!cancelled) setOptions(rows)
    })()
    return () => {
      cancelled = true
    }
  }, [scopeVersion])

  if (!statusAdvance.enforced || statusAdvance.items.length === 0) return null

  return (
    <div
      className="min-w-0 shrink-0"
      role="group"
      aria-label={t('procurement.processes.detail.statusTransition', 'Transition')}
    >
      <div className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-input bg-muted/30 p-1 shadow-xs">
        <span className="shrink-0 px-1.5 text-sm font-normal text-muted-foreground">
          {t('procurement.processes.detail.statusTransition', 'Transition')}
        </span>
        {statusAdvance.items.map((it) => {
          const opt = options.find((o) => o.value === it.toStatusValue)
          return (
            <Button
              key={it.toStatusValue}
              type="button"
              size="sm"
              variant="outline"
              disabled={!allowEdits}
              className="inline-flex h-8 items-center gap-2 border-border/80 bg-background px-2.5 font-normal shadow-none hover:bg-accent"
              onClick={() => void onAdvanceStatus(it.toStatusValue)}
            >
              <span className="inline-flex items-center gap-2">
                {opt?.color?.trim() ? (
                  <span className="inline-flex h-7 shrink-0 items-center justify-center">
                    {renderDictionaryColor(opt.color.trim(), 'h-3 w-3 rounded-sm')}
                  </span>
                ) : null}
                {opt?.icon?.trim() ? (
                  <span className="inline-flex size-7 shrink-0 items-center justify-center text-muted-foreground">
                    {renderDictionaryIcon(opt.icon, 'size-4')}
                  </span>
                ) : null}
                <span className="font-normal leading-tight">{it.toStatusLabel}</span>
              </span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
