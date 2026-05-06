'use client'

import * as React from 'react'
import { IconButton } from '@open-mercato/ui/primitives/icon-button'
import { X } from 'lucide-react'
import { DictionaryEntrySelect, type DictionaryOption, type DictionarySelectLabels } from './DictionaryEntrySelect'
import { DictionaryAppearancePreview } from './dictionaryAppearance'
import type { AppearanceSelectorLabels } from './AppearanceSelector'

export type DictionaryEntryMultiSelectProps = {
  value: string[]
  onChange: (next: string[]) => void
  fetchOptions: () => Promise<DictionaryOption[]>
  createOption?: (input: {
    value: string
    label?: string
    color?: string | null
    icon?: string | null
  }) => Promise<DictionaryOption | null>
  labels: DictionarySelectLabels
  manageHref?: string
  selectClassName?: string
  allowInlineCreate?: boolean
  allowAppearance?: boolean
  appearanceLabels?: AppearanceSelectorLabels
  disabled?: boolean
  showManage?: boolean
  /** Accessible label for removing one selected entry from the list. */
  removeEntryAriaLabel: string
}

export function DictionaryEntryMultiSelect({
  value,
  onChange,
  fetchOptions,
  createOption,
  labels,
  manageHref,
  selectClassName,
  allowInlineCreate = true,
  allowAppearance = false,
  appearanceLabels,
  disabled: disabledProp = false,
  showManage = true,
  removeEntryAriaLabel,
}: DictionaryEntryMultiSelectProps) {
  const selected = React.useMemo(
    () => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : []),
    [value],
  )
  const [adderKey, setAdderKey] = React.useState(0)
  const [entryDisplay, setEntryDisplay] = React.useState<Record<string, { label: string; color: string | null; icon: string | null }>>({})

  const fetchOptionsForAdder = React.useCallback(async () => {
    const all = await fetchOptions()
    return all.filter((o) => !selected.includes(o.value))
  }, [fetchOptions, selected])

  React.useEffect(() => {
    let cancelled = false
    void fetchOptions().then((opts) => {
      if (cancelled) return
      const next: Record<string, { label: string; color: string | null; icon: string | null }> = {}
      for (const o of opts) {
        next[o.value] = { label: o.label, color: o.color ?? null, icon: o.icon ?? null }
      }
      setEntryDisplay(next)
    })
    return () => {
      cancelled = true
    }
  }, [fetchOptions, adderKey])

  const appendSelection = React.useCallback(
    (next: string | undefined) => {
      const trimmed = typeof next === 'string' ? next.trim() : ''
      if (!trimmed.length) return
      if (selected.includes(trimmed)) return
      onChange([...selected, trimmed])
      setAdderKey((k) => k + 1)
    },
    [selected, onChange],
  )

  const remove = (code: string) => {
    onChange(selected.filter((x) => x !== code))
  }

  return (
    <div className="space-y-2">
      <div key={adderKey}>
        <DictionaryEntrySelect
          value={undefined}
          onChange={(next) => {
            appendSelection(next)
          }}
          fetchOptions={fetchOptionsForAdder}
          createOption={createOption}
          labels={labels}
          appearanceLabels={appearanceLabels}
          allowAppearance={allowAppearance}
          allowInlineCreate={allowInlineCreate}
          disabled={disabledProp}
          manageHref={manageHref}
          selectClassName={selectClassName}
          showManage={showManage}
        />
      </div>

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((code) => {
            const meta = entryDisplay[code]
            const label = meta?.label ?? code
            return (
              <span
                key={code}
                className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
              >
                <DictionaryAppearancePreview
                  color={meta?.color ?? null}
                  icon={meta?.icon ?? null}
                  label={label}
                  className="min-w-0 flex-1"
                  iconWrapperClassName="inline-flex size-5 shrink-0 items-center justify-center text-muted-foreground"
                  iconClassName="size-3.5"
                />
                <IconButton
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  disabled={disabledProp}
                  aria-label={removeEntryAriaLabel}
                  onClick={() => remove(code)}
                >
                  <X className="size-3.5" />
                </IconButton>
              </span>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
