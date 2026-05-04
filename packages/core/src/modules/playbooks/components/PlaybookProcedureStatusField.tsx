'use client'

import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { DictionaryEntrySelect } from '@open-mercato/core/modules/dictionaries/components/DictionaryEntrySelect'
import {
  ensureDictionaryEntries,
  invalidateDictionaryEntries,
} from '@open-mercato/core/modules/dictionaries/components/hooks/useDictionaryEntries'
import { IconButton } from '@open-mercato/ui/primitives/icon-button'
import { X } from 'lucide-react'
import type { CrudCustomFieldRenderProps } from '@open-mercato/ui/backend/CrudForm'
import type { PlaybookFormTranslator } from './playbookFormConfig'

type EntryDisplay = { label: string; color: string | null; icon: string | null }

export function buildPlaybookProcedureStatusField(
  t: PlaybookFormTranslator,
): (props: CrudCustomFieldRenderProps) => React.ReactNode {
  return function PlaybookProcedureStatusField(props: CrudCustomFieldRenderProps) {
    const { value, setValue, disabled, error } = props
    const tGlobal = useT()
    const queryClient = useQueryClient()
    const scopeVersion = useOrganizationScopeVersion()
    const selected = Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
    const [dictionaryId, setDictionaryId] = React.useState<string | null>(null)
    const [loadError, setLoadError] = React.useState<string | null>(null)
    const [adderKey, setAdderKey] = React.useState(0)
    const [entryDisplay, setEntryDisplay] = React.useState<Record<string, EntryDisplay>>({})

    React.useEffect(() => {
      let cancelled = false
      void apiCall<{ dictionaryId?: string }>('/api/playbooks/dictionaries/procedure-status')
        .then((call) => {
          if (cancelled) return
          if (call.ok && typeof call.result?.dictionaryId === 'string' && call.result.dictionaryId.length) {
            setDictionaryId(call.result.dictionaryId)
            setLoadError(null)
            return
          }
          setLoadError(
            t('playbooks.dictionary.errors.ensure', 'Could not ensure playbook status dictionary.'),
          )
        })
        .catch(() => {
          if (!cancelled) {
            setLoadError(t('playbooks.dictionary.errors.ensure', 'Could not ensure playbook status dictionary.'))
          }
        })
      return () => {
        cancelled = true
      }
    }, [t])

    const fetchOptions = React.useCallback(async () => {
      if (!dictionaryId) return []
      const data = await ensureDictionaryEntries(queryClient, dictionaryId, scopeVersion)
      return data.entries.map((entry) => ({
        value: entry.value,
        label: entry.label,
        color: entry.color ?? null,
        icon: entry.icon ?? null,
      }))
    }, [dictionaryId, queryClient, scopeVersion])

    const fetchOptionsForAdder = React.useCallback(async () => {
      const all = await fetchOptions()
      return all.filter((o) => !selected.includes(o.value))
    }, [fetchOptions, selected])

    const createOption = React.useCallback(
      async (input: { value: string; label?: string; color?: string | null; icon?: string | null }) => {
        if (!dictionaryId) return null
        const call = await apiCall<Record<string, unknown>>(`/api/dictionaries/${dictionaryId}/entries`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            value: input.value,
            label: input.label ?? input.value,
            color: input.color,
            icon: input.icon,
          }),
        })
        if (!call.ok) {
          throw new Error(
            typeof call.result?.error === 'string' ? call.result.error : 'Failed to create dictionary entry',
          )
        }
        await invalidateDictionaryEntries(queryClient, dictionaryId)
        return {
          value: String(call.result?.value ?? input.value),
          label:
            typeof call.result?.label === 'string' && call.result.label.length
              ? call.result.label
              : String(call.result?.value ?? input.value),
          color: typeof call.result?.color === 'string' ? call.result.color : null,
          icon: typeof call.result?.icon === 'string' ? call.result.icon : null,
        }
      },
      [dictionaryId, queryClient],
    )

    React.useEffect(() => {
      if (!dictionaryId) return
      let cancelled = false
      void fetchOptions().then((opts) => {
        if (cancelled) return
        const next: Record<string, EntryDisplay> = {}
        for (const o of opts) {
          next[o.value] = { label: o.label, color: o.color, icon: o.icon ?? null }
        }
        setEntryDisplay(next)
      })
      return () => {
        cancelled = true
      }
    }, [dictionaryId, fetchOptions, adderKey])

    const labels = React.useMemo(
      () => ({
        placeholder: t('playbooks.form.procedureStatus.placeholder', 'Select or add a tag…'),
        addLabel: tGlobal('dictionaries.customFields.selector.add', 'Add entry'),
        addPrompt: tGlobal(
          'dictionaries.customFields.selector.dialogDescription',
          'Create a new entry and reuse it across records.',
        ),
        dialogTitle: tGlobal('dictionaries.config.entries.dialog.addTitle', 'Add dictionary entry'),
        valueLabel: tGlobal('dictionaries.config.entries.dialog.valueLabel', 'Value'),
        valuePlaceholder: tGlobal('dictionaries.config.entries.dialog.valueLabel', 'Value'),
        labelLabel: tGlobal('dictionaries.config.entries.dialog.labelLabel', 'Label'),
        labelPlaceholder: tGlobal('dictionaries.config.entries.dialog.labelPlaceholder', 'Display name shown in UI'),
        emptyError: tGlobal('dictionaries.config.entries.error.required', 'Value is required.'),
        cancelLabel: tGlobal('dictionaries.config.entries.dialog.cancel', 'Cancel'),
        saveLabel: tGlobal('dictionaries.config.entries.dialog.save', 'Save'),
        saveShortcutHint: tGlobal('dictionaries.config.entries.dialog.saveShortcut', '⌘/Ctrl + Enter'),
        successCreateLabel: tGlobal('dictionaries.config.entries.success.create', 'Dictionary entry created.'),
        errorLoad: tGlobal('dictionaries.config.entries.error.load', 'Failed to load dictionary entries.'),
        errorSave: tGlobal('dictionaries.config.entries.error.save', 'Failed to save dictionary entry.'),
        loadingLabel: tGlobal('dictionaries.config.entries.loading', 'Loading entries…'),
        manageTitle: tGlobal('dictionaries.customFields.manageLink', 'Manage dictionaries'),
      }),
      [t, tGlobal],
    )

    const appearanceLabels = React.useMemo(
      () => ({
        colorLabel: tGlobal('dictionaries.config.entries.dialog.colorLabel', 'Color'),
        colorHelp: tGlobal('dictionaries.config.entries.dialog.colorHelp', 'Pick a highlight color for this entry.'),
        colorClearLabel: tGlobal('dictionaries.config.entries.dialog.colorClear', 'Remove color'),
        iconLabel: tGlobal('dictionaries.config.entries.dialog.iconLabel', 'Icon or emoji'),
        iconPlaceholder: tGlobal('dictionaries.config.entries.dialog.iconPlaceholder', 'Type an emoji or icon token.'),
        iconPickerTriggerLabel: tGlobal('dictionaries.config.entries.dialog.iconBrowse', 'Browse icons and emoji'),
        iconSearchPlaceholder: tGlobal(
          'dictionaries.config.entries.dialog.iconSearchPlaceholder',
          'Search icons or emojis…',
        ),
        iconSearchEmptyLabel: tGlobal('dictionaries.config.entries.dialog.iconSearchEmpty', 'No icons match your search.'),
        iconSuggestionsLabel: tGlobal('dictionaries.config.entries.dialog.iconSuggestions', 'Suggestions'),
        iconClearLabel: tGlobal('dictionaries.config.entries.dialog.iconClear', 'Remove icon'),
        previewEmptyLabel: tGlobal('dictionaries.config.entries.dialog.previewEmpty', 'No appearance selected'),
      }),
      [tGlobal],
    )

    const appendSelection = React.useCallback(
      (next: string | undefined) => {
        const trimmed = typeof next === 'string' ? next.trim() : ''
        if (!trimmed.length) return
        if (selected.includes(trimmed)) return
        setValue([...selected, trimmed])
        setAdderKey((k) => k + 1)
      },
      [selected, setValue],
    )

    const remove = (v: string) => {
      setValue(selected.filter((x) => x !== v))
    }

    if (loadError) {
      return <div className="text-sm text-red-600">{loadError}</div>
    }

    if (!dictionaryId) {
      return <div className="text-sm text-muted-foreground">{tGlobal('common.loading', 'Loading…')}</div>
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
            allowAppearance
            allowInlineCreate
            disabled={disabled}
            manageHref="/backend/config/dictionaries"
          />
        </div>

        {selected.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selected.map((v) => {
              const meta = entryDisplay[v]
              const label = meta?.label ?? v
              return (
                <span
                  key={v}
                  className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  <IconButton
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    disabled={disabled}
                    aria-label={t('playbooks.form.contextTagsRemove', 'Remove tag')}
                    onClick={() => remove(v)}
                  >
                    <X className="size-3.5" />
                  </IconButton>
                </span>
              )
            })}
          </div>
        ) : null}

        {error ? <div className="text-xs text-red-600">{error}</div> : null}
      </div>
    )
  }
}
