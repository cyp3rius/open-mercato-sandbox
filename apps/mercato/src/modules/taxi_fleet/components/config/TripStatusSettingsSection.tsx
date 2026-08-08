'use client'

import * as React from 'react'
import { ChevronDown, Ellipsis, Plus, Trash2 } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { Button } from '@open-mercato/ui/primitives/button'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { CRUD_FORM_TEXT_INPUT_CLASS } from '@open-mercato/ui/backend/CrudForm'
import {
  DictionaryAppearancePreview,
  ICON_LIBRARY,
  ICON_SUGGESTIONS,
  renderDictionaryIcon,
} from '@open-mercato/core/modules/dictionaries/components/dictionaryAppearance'
import {
  TAXI_FLEET_STATUS_ENTER_ACTIONS,
  createEmptyTripStatusDefinition,
  type TaxiFleetStatusEnterAction,
  type TaxiFleetTripStatusDefinition,
} from '../../lib/tripStatuses'

type TripStatusSettingsSectionProps = {
  tripStatuses: TaxiFleetTripStatusDefinition[]
  onChange: (next: TaxiFleetTripStatusDefinition[]) => void
  disabled?: boolean
}

function updateEntry(
  tripStatuses: TaxiFleetTripStatusDefinition[],
  index: number,
  patch: Partial<TaxiFleetTripStatusDefinition>,
): TaxiFleetTripStatusDefinition[] {
  const next = [...tripStatuses]
  const current = next[index]
  if (!current) return tripStatuses
  next[index] = { ...current, ...patch }
  return next
}

type InlineIconFieldProps = {
  value: string
  disabled?: boolean
  browseLabel: string
  searchPlaceholder: string
  searchEmptyLabel: string
  clearLabel: string
  onChange: (next: string) => void
}

function InlineIconField({
  value,
  disabled,
  browseLabel,
  searchPlaceholder,
  searchEmptyLabel,
  clearLabel,
  onChange,
}: InlineIconFieldProps) {
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [iconSearch, setIconSearch] = React.useState('')
  const pickerContainerRef = React.useRef<HTMLDivElement | null>(null)

  const closePicker = React.useCallback(() => {
    setPickerOpen(false)
    setIconSearch('')
  }, [])

  React.useEffect(() => {
    if (!pickerOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (pickerContainerRef.current?.contains(target)) return
      closePicker()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePicker()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [closePicker, pickerOpen])

  const filteredIcons = React.useMemo(() => {
    const term = iconSearch.trim().toLowerCase()
    if (!term) return ICON_LIBRARY.slice(0, 48)
    return ICON_LIBRARY.filter((option) => {
      const haystack = [option.label, option.value, ...(option.keywords ?? [])].join(' ').toLowerCase()
      return haystack.includes(term)
    }).slice(0, 120)
  }, [iconSearch])

  return (
    <div ref={pickerContainerRef} className="relative flex min-w-0 max-w-full items-center gap-1">
      <input
        type="text"
        value={value}
        disabled={disabled}
        className={cn(CRUD_FORM_TEXT_INPUT_CLASS, 'h-9 min-w-0 flex-1 px-2 text-xs')}
        onChange={(event) => onChange(event.target.value)}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-9 shrink-0"
        disabled={disabled}
        aria-label={browseLabel}
        aria-expanded={pickerOpen}
        onClick={() => setPickerOpen((open) => !open)}
      >
        <Ellipsis className="size-4" />
      </Button>
      {pickerOpen ? (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-md border border-border bg-popover p-3 shadow-lg">
          <input
            type="search"
            value={iconSearch}
            onChange={(event) => setIconSearch(event.target.value)}
            placeholder={searchPlaceholder}
            className="mb-2 w-full rounded border border-border px-2 py-1.5 text-sm"
            autoComplete="off"
          />
          <div className="max-h-48 overflow-y-auto">
            {filteredIcons.length ? (
              <div className="grid grid-cols-6 gap-1">
                {filteredIcons.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={value === option.value ? 'bg-primary/10 text-primary ring-1 ring-primary/60' : 'size-8'}
                    onClick={() => {
                      onChange(option.value)
                      closePicker()
                    }}
                    title={option.label}
                  >
                    {renderDictionaryIcon(option.value, 'size-4')}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{searchEmptyLabel}</p>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1 border-t pt-2">
            {ICON_SUGGESTIONS.slice(0, 8).map((suggestion) => (
              <Button
                key={suggestion.value}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  onChange(suggestion.value)
                  closePicker()
                }}
              >
                {renderDictionaryIcon(suggestion.value, 'size-3')}
              </Button>
            ))}
          </div>
          <div className="mt-2 flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>
              {clearLabel}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

const ROW_GRID =
  'md:grid-cols-[minmax(7rem,9rem)_minmax(6rem,7rem)_minmax(0,1fr)_2.5rem_minmax(6.5rem,8rem)_2rem_minmax(7rem,9rem)]'

export function TripStatusSettingsSection({ tripStatuses, onChange, disabled }: TripStatusSettingsSectionProps) {
  const t = useT()
  const [expandedIndices, setExpandedIndices] = React.useState<Set<number>>(() => new Set())
  const [pendingActionByIndex, setPendingActionByIndex] = React.useState<Record<number, TaxiFleetStatusEnterAction | ''>>({})

  const actionLabel = React.useCallback(
    (action: TaxiFleetStatusEnterAction) =>
      t(`taxi_fleet.config.trip_statuses.actions.${action}`, action),
    [t],
  )

  const toggleExpanded = React.useCallback((index: number) => {
    setExpandedIndices((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  const addStatus = React.useCallback(() => {
    const nextSort = tripStatuses.reduce((max, entry) => Math.max(max, entry.sortOrder), 0) + 10
    onChange([...tripStatuses, createEmptyTripStatusDefinition(nextSort)])
  }, [onChange, tripStatuses])

  const removeStatus = React.useCallback(
    (index: number) => {
      if (tripStatuses.length <= 1) return
      onChange(tripStatuses.filter((_, rowIndex) => rowIndex !== index))
      setExpandedIndices((current) => {
        const next = new Set<number>()
        for (const rowIndex of current) {
          if (rowIndex === index) continue
          next.add(rowIndex > index ? rowIndex - 1 : rowIndex)
        }
        return next
      })
    },
    [onChange, tripStatuses],
  )

  const addAction = React.useCallback(
    (index: number, entry: TaxiFleetTripStatusDefinition) => {
      const pending = pendingActionByIndex[index] ?? ''
      if (!pending || entry.onEnterActions.includes(pending)) return
      onChange(updateEntry(tripStatuses, index, { onEnterActions: [...entry.onEnterActions, pending] }))
      setPendingActionByIndex((current) => ({ ...current, [index]: '' }))
    },
    [onChange, pendingActionByIndex, tripStatuses],
  )

  const removeAction = React.useCallback(
    (index: number, entry: TaxiFleetTripStatusDefinition, action: TaxiFleetStatusEnterAction) => {
      onChange(
        updateEntry(tripStatuses, index, {
          onEnterActions: entry.onEnterActions.filter((item) => item !== action),
        }),
      )
    },
    [onChange, tripStatuses],
  )

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={addStatus}>
          <Plus className="mr-1.5 size-4" />
          {t('taxi_fleet.config.trip_statuses.addStatus', 'Add status')}
        </Button>
      </div>

      <div className="divide-y rounded-md border">
        <div
          className={cn(
            'hidden gap-2 px-4 py-2 text-xs font-medium text-muted-foreground md:grid md:items-center',
            ROW_GRID,
          )}
        >
          <span>{t('taxi_fleet.config.trip_statuses.preview', 'Preview')}</span>
          <span>{t('taxi_fleet.config.trip_statuses.columnCode', 'Code')}</span>
          <span>{t('taxi_fleet.config.trip_statuses.label', 'Label')}</span>
          <span>{t('dictionaries.config.entries.dialog.colorLabel', 'Color')}</span>
          <span>{t('dictionaries.config.entries.dialog.iconLabel', 'Icon')}</span>
          <span />
          <span className="text-right">{t('taxi_fleet.config.trip_statuses.columnActions', 'Actions')}</span>
        </div>

        {tripStatuses.map((entry, index) => {
          const expanded = expandedIndices.has(index)
          const availableActions = TAXI_FLEET_STATUS_ENTER_ACTIONS.filter(
            (action) => !entry.onEnterActions.includes(action),
          )
          const pendingAction = pendingActionByIndex[index] ?? ''
          const actionCount = entry.onEnterActions.length
          const normalizedColor = entry.color?.trim() || '#64748b'
          const previewLabel = entry.label.trim() || entry.code.trim() || t('taxi_fleet.config.trip_statuses.previewEmpty', 'New status')

          return (
            <div key={`trip-status-row-${index}`} className="bg-card">
              <div className={cn('flex flex-col gap-3 px-4 py-3 md:grid md:items-center md:gap-2', ROW_GRID)}>
                <div className="flex min-h-9 min-w-0 items-center overflow-hidden rounded-md border border-dashed border-border px-2 py-1">
                  <DictionaryAppearancePreview
                    color={entry.color}
                    icon={entry.icon}
                    label={previewLabel}
                    className="min-w-0"
                    labelClassName="text-sm"
                  />
                </div>

                <input
                  type="text"
                  className={cn(CRUD_FORM_TEXT_INPUT_CLASS, 'h-9 min-w-0 font-mono text-xs')}
                  value={entry.code}
                  disabled={disabled}
                  placeholder={t('taxi_fleet.config.trip_statuses.codePlaceholder', 'status_code')}
                  onChange={(event) => {
                    onChange(updateEntry(tripStatuses, index, { code: event.target.value }))
                  }}
                />

                <input
                  id={`trip-status-label-${index}`}
                  type="text"
                  className={cn(CRUD_FORM_TEXT_INPUT_CLASS, 'h-9 min-w-0')}
                  value={entry.label}
                  disabled={disabled}
                  onChange={(event) => {
                    onChange(updateEntry(tripStatuses, index, { label: event.target.value }))
                  }}
                />

                <input
                  type="color"
                  value={normalizedColor}
                  disabled={disabled}
                  className="h-9 w-10 shrink-0 cursor-pointer rounded border border-border bg-background"
                  aria-label={t('dictionaries.config.entries.dialog.colorLabel', 'Color')}
                  onChange={(event) => {
                    onChange(updateEntry(tripStatuses, index, { color: event.target.value }))
                  }}
                />

                <div className="min-w-0">
                  <InlineIconField
                    value={entry.icon ?? ''}
                    disabled={disabled}
                    browseLabel={t('dictionaries.config.entries.dialog.iconBrowse', 'Browse icons and emoji')}
                    searchPlaceholder={t('dictionaries.config.entries.dialog.iconSearchPlaceholder', 'Search icons or emojis…')}
                    searchEmptyLabel={t('dictionaries.config.entries.dialog.iconSearchEmpty', 'No icons match your search.')}
                    clearLabel={t('dictionaries.config.entries.dialog.iconClear', 'Remove icon')}
                    onChange={(next) => {
                      onChange(updateEntry(tripStatuses, index, { icon: next }))
                    }}
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="relative z-10 size-8 shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={disabled || tripStatuses.length <= 1}
                  aria-label={t('taxi_fleet.config.trip_statuses.removeStatus', 'Remove status')}
                  onClick={() => removeStatus(index)}
                >
                  <Trash2 className="size-4" />
                </Button>

                <div className="relative z-10 min-w-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-full justify-between gap-1.5 px-2"
                    disabled={disabled}
                    onClick={() => toggleExpanded(index)}
                    aria-expanded={expanded}
                    aria-controls={`trip-status-actions-${index}`}
                    aria-label={t('taxi_fleet.config.trip_statuses.toggleDetails', 'Toggle status details')}
                  >
                    <Badge variant="secondary" className="pointer-events-none min-w-0 truncate">
                      {actionCount === 1
                        ? t('taxi_fleet.config.trip_statuses.actionCountOne', '1 action')
                        : t('taxi_fleet.config.trip_statuses.actionCount', '{{count}} actions').replace(
                            '{{count}}',
                            String(actionCount),
                          )}
                    </Badge>
                    <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', expanded && 'rotate-180')} />
                  </Button>
                </div>
              </div>

              {expanded ? (
                <div
                  id={`trip-status-actions-${index}`}
                  className="space-y-3 border-t bg-muted/20 px-4 py-4"
                >
                  <div>
                    <div className="text-sm font-medium">
                      {t('taxi_fleet.config.trip_statuses.onEnterActions', 'Actions when entering this status')}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t(
                        'taxi_fleet.config.trip_statuses.onEnterActionsHelp',
                        'Add CRM notifications or customer emails to run when a trip enters this status.',
                      )}
                    </p>
                  </div>

                  {entry.onEnterActions.length ? (
                    <ul className="space-y-2">
                      {entry.onEnterActions.map((action) => (
                        <li
                          key={`${index}-${action}`}
                          className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2"
                        >
                          <span className="text-sm">{actionLabel(action)}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                            disabled={disabled}
                            onClick={() => removeAction(index, entry, action)}
                            aria-label={t('taxi_fleet.config.trip_statuses.removeAction', 'Remove action')}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t('taxi_fleet.config.trip_statuses.noActions', 'No actions configured.')}
                    </p>
                  )}

                  {availableActions.length ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <select
                        className={cn(CRUD_FORM_TEXT_INPUT_CLASS, 'sm:max-w-md')}
                        value={pendingAction}
                        disabled={disabled}
                        onChange={(event) => {
                          const value = event.target.value
                          setPendingActionByIndex((current) => ({
                            ...current,
                            [index]: value as TaxiFleetStatusEnterAction | '',
                          }))
                        }}
                      >
                        <option value="">
                          {t('taxi_fleet.config.trip_statuses.selectAction', 'Select action…')}
                        </option>
                        {availableActions.map((action) => (
                          <option key={action} value={action}>
                            {actionLabel(action)}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        disabled={disabled || !pendingAction}
                        onClick={() => addAction(index, entry)}
                      >
                        <Plus className="mr-1.5 size-4" />
                        {t('taxi_fleet.config.trip_statuses.addAction', 'Add action')}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
