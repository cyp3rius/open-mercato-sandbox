"use client"

import * as React from 'react'
import { Command } from 'cmdk'
import * as LucideIcons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import {
  extractLucideSlug,
  renderDictionaryColor,
  renderDictionaryIcon,
} from '@open-mercato/core/modules/dictionaries/components/dictionaryAppearance'
import { Button } from '../../primitives/button'
import { IconButton } from '../../primitives/icon-button'
import { Popover, PopoverContent, PopoverTrigger } from '../../primitives/popover'

const LEGACY_LUCIDE_PASCAL = /^[A-Z][a-zA-Z0-9]*$/

function renderDictionarySourceIcon(icon: string | null | undefined, className: string): React.ReactNode {
  const trimmed = icon?.trim() ?? ''
  if (!trimmed.length) return null
  if (extractLucideSlug(trimmed)) {
    const rendered = renderDictionaryIcon(trimmed, className)
    if (rendered) return rendered
  }
  const map = LucideIcons as Record<string, LucideIcon>
  if (LEGACY_LUCIDE_PASCAL.test(trimmed) && map[trimmed]) {
    const Cmp = map[trimmed]!
    return <Cmp className={className} aria-hidden />
  }
  return renderDictionaryIcon(trimmed, className)
}

export type EntitySearchComboboxOption = {
  value: string
  label: string
  description?: string | null
  /** Dictionary / catalog appearance */
  icon?: string
  color?: string
}

export type EntitySearchComboboxProps = {
  value: string
  onChange: (next: string) => void
  options: EntitySearchComboboxOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  /** When set, search queries the server; cmdk filtering is disabled. */
  onRemoteSearch?: (query: string) => Promise<EntitySearchComboboxOption[]>
  /** Opens in a new browser tab (e.g. create entity / settings). Hidden when null/undefined/empty. */
  createInNewTabHref?: string | null
  createInNewTabAriaLabel?: string
  /** Shown on the trigger when `value` is set but the label is not yet in `options` (e.g. async title). */
  selectedDisplayOverride?: string
  resolveDisplayLabel?: (value: string) => string
  className?: string
}

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    if (ms <= 0) {
      setDebounced(value)
      return
    }
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

export function EntitySearchCombobox({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled = false,
  onRemoteSearch,
  createInNewTabHref,
  createInNewTabAriaLabel,
  selectedDisplayOverride,
  resolveDisplayLabel,
  className,
}: EntitySearchComboboxProps) {
  const t = useT()
  const isRemote = typeof onRemoteSearch === 'function'
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const remoteDelay = query.trim().length === 0 ? 0 : 280
  const debouncedQuery = useDebouncedValue(query, isRemote ? remoteDelay : 0)
  const [remoteRows, setRemoteRows] = React.useState<EntitySearchComboboxOption[]>([])
  const [remoteLoading, setRemoteLoading] = React.useState(false)

  const defaultSearchPh = searchPlaceholder ?? t('ui.forms.entitySearch.searchPlaceholder', 'Search…')
  const defaultEmpty = emptyText ?? t('ui.forms.entitySearch.empty', 'No results.')
  const addLabel =
    createInNewTabAriaLabel ?? t('ui.forms.entitySearch.addInNewTab', 'Add in a new tab')

  const localRows = options

  React.useEffect(() => {
    if (!isRemote || !open) return
    let cancelled = false
    setRemoteLoading(true)
    void onRemoteSearch(debouncedQuery.trim())
      .then((rows) => {
        if (!cancelled) setRemoteRows(rows)
      })
      .catch(() => {
        if (!cancelled) setRemoteRows([])
      })
      .finally(() => {
        if (!cancelled) setRemoteLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedQuery, isRemote, onRemoteSearch, open])

  const rows = isRemote ? remoteRows : localRows

  const selectedOption = React.useMemo(() => {
    if (!value) return null
    return rows.find((o) => o.value === value) ?? localRows.find((o) => o.value === value) ?? null
  }, [value, rows, localRows])

  const triggerLabel = React.useMemo(() => {
    if (!value) return ''
    if (selectedOption) return selectedOption.label
    if (selectedDisplayOverride?.trim()) return selectedDisplayOverride.trim()
    return resolveDisplayLabel?.(value) ?? value
  }, [value, selectedOption, selectedDisplayOverride, resolveDisplayLabel])

  const handleOpenChange = React.useCallback((next: boolean) => {
    setOpen(next)
    if (next) setQuery('')
  }, [])

  const showAdd =
    typeof createInNewTabHref === 'string' && createInNewTabHref.trim().length > 0 && !disabled

  const openCreate = React.useCallback(() => {
    const href = typeof createInNewTabHref === 'string' ? createInNewTabHref.trim() : ''
    if (!href.length) return
    window.open(href, '_blank', 'noopener,noreferrer')
  }, [createInNewTabHref])

  return (
    <div className={cn('flex min-w-0 items-center gap-1.5', className)}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            aria-expanded={open}
            className={cn(
              'h-9 min-w-0 flex-1 justify-between rounded border border-input bg-transparent px-2 text-sm font-normal shadow-none hover:bg-muted/30 dark:hover:bg-muted/30',
              !value && 'text-muted-foreground',
            )}
            data-crud-focus-target=""
          >
            <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
              {value && selectedOption?.color?.trim() ? (
                <span className="shrink-0">{renderDictionaryColor(selectedOption.color.trim(), 'h-3 w-3 rounded-sm')}</span>
              ) : null}
              {value && selectedOption?.icon?.trim() ? (
                <span className="inline-flex size-5 shrink-0 items-center justify-center text-muted-foreground">
                  {renderDictionarySourceIcon(selectedOption.icon, 'size-4')}
                </span>
              ) : null}
              <span className="truncate">{value ? triggerLabel : placeholder ?? ''}</span>
            </span>
            <ChevronDown className="ml-1 size-4 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(100vw-2rem,var(--radix-popover-trigger-width,24rem))] p-0" align="start">
          <Command shouldFilter={!isRemote} className="overflow-hidden rounded-md bg-popover text-popover-foreground">
            <div className="border-b px-0">
              <Command.Input
                placeholder={defaultSearchPh}
                value={query}
                onValueChange={setQuery}
                className="flex h-9 w-full border-0 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Command.List className="max-h-60 overflow-y-auto p-1">
              {remoteLoading ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  {t('common.loading', 'Loading…')}
                </div>
              ) : (
                <>
                  <Command.Empty className="px-3 py-2 text-center text-xs text-muted-foreground">
                    {defaultEmpty}
                  </Command.Empty>
                  <Command.Group>
                    {rows.map((opt, index) => (
                      <Command.Item
                        key={opt.value ? opt.value : `empty-${index}`}
                        value={`${opt.label} ${opt.value}`}
                        onSelect={() => {
                          onChange(opt.value)
                          setOpen(false)
                        }}
                        className="flex cursor-pointer flex-col gap-0.5 rounded-sm px-2 py-1.5 text-sm aria-selected:bg-accent"
                      >
                        <span className="flex w-full min-w-0 items-center gap-2">
                          <Check
                            className={cn('size-4 shrink-0', value === opt.value ? 'opacity-100' : 'opacity-0')}
                          />
                          {opt.color?.trim() ? (
                            <span className="shrink-0">{renderDictionaryColor(opt.color.trim(), 'h-3 w-3 rounded-sm')}</span>
                          ) : null}
                          {opt.icon?.trim() ? (
                            <span className="inline-flex size-5 shrink-0 items-center justify-center text-muted-foreground">
                              {renderDictionarySourceIcon(opt.icon, 'size-4')}
                            </span>
                          ) : null}
                          <span className="min-w-0 truncate font-medium">{opt.label}</span>
                        </span>
                        {opt.description ? (
                          <span className="pl-10 text-xs text-muted-foreground">{opt.description}</span>
                        ) : null}
                      </Command.Item>
                    ))}
                  </Command.Group>
                </>
              )}
            </Command.List>
          </Command>
        </PopoverContent>
      </Popover>
      {showAdd ? (
        <IconButton
          type="button"
          variant="outline"
          size="lg"
          className="size-9 shrink-0"
          aria-label={addLabel}
          title={addLabel}
          disabled={disabled}
          onClick={openCreate}
        >
          <Plus className="size-4" />
        </IconButton>
      ) : null}
    </div>
  )
}
