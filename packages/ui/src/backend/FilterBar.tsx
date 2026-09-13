"use client"
import * as React from 'react'
import { Button } from '../primitives/button'
import { FilterDef, FilterOverlay, FilterValues } from './FilterOverlay'
import { useT } from '@open-mercato/shared/lib/i18n/context'

export type FilterBarProps = {
  searchValue?: string
  onSearchChange?: (v: string) => void
  searchPlaceholder?: string
  searchAlign?: 'left' | 'right'
  filters?: FilterDef[]
  values?: FilterValues
  onApply?: (values: FilterValues) => void
  onClear?: () => void
  className?: string
  leadingItems?: React.ReactNode
  trailingItems?: React.ReactNode
  layout?: 'stacked' | 'inline'
  filtersExtraContent?: React.ReactNode
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchAlign = 'left',
  filters = [],
  values = {},
  onApply,
  onClear,
  className,
  leadingItems,
  trailingItems,
  layout = 'stacked',
  filtersExtraContent,
}: FilterBarProps) {
  const t = useT()
  const resolvedSearchPlaceholder = searchPlaceholder ?? t('ui.filterBar.searchPlaceholder', 'Search')
  const [open, setOpen] = React.useState(false)
  const [searchDraft, setSearchDraft] = React.useState(searchValue ?? '')
  const lastAppliedSearchRef = React.useRef(searchValue ?? '')

  React.useEffect(() => {
    const next = searchValue ?? ''
    lastAppliedSearchRef.current = next
    setSearchDraft((prev) => (prev === next ? prev : next))
  }, [searchValue])

  React.useEffect(() => {
    if (!onSearchChange) return
    const handle = window.setTimeout(() => {
      if (lastAppliedSearchRef.current === searchDraft) return
      lastAppliedSearchRef.current = searchDraft
      onSearchChange(searchDraft)
    }, 1000)
    return () => {
      window.clearTimeout(handle)
    }
  }, [searchDraft, onSearchChange])

  const activeCount = React.useMemo(() => {
    const isActive = (v: any) => {
      if (v == null) return false
      if (typeof v === 'string') return v.trim() !== ''
      if (Array.isArray(v)) return v.length > 0
      if (typeof v === 'object') return Object.values(v).some((x) => x != null && x !== '')
      return Boolean(v)
    }
    return Object.values(values).filter(isActive).length
  }, [values])

  const containerClass = `flex flex-col ${layout === 'inline' ? 'gap-1 sm:gap-2' : 'gap-2'} w-full`

  return (
    <div className={`${containerClass} ${className ?? ''}`}>
      <div className="flex flex-wrap items-center gap-2 w-full">
        {filters.length > 0 && (
          <Button variant="outline" className="h-9" onClick={() => setOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="opacity-80"><path d="M3 4h18"/><path d="M6 8h12l-3 8H9L6 8z"/></svg>
            {activeCount 
              ? t('ui.filterBar.filtersWithCount', 'Filters {count}', { count: activeCount })
              : t('ui.filterBar.filters', 'Filters')
            }
          </Button>
        )}
        {leadingItems}
        {trailingItems}
        {onSearchChange && (
          <div className={`relative w-full sm:w-auto sm:min-w-[180px] sm:max-w-[240px] ${searchAlign === 'right' ? 'sm:ml-auto' : ''}`}>
            <input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder={resolvedSearchPlaceholder}
              className="h-9 w-full rounded border pl-8 pr-2 text-sm"
              suppressHydrationWarning
            />
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">🔍</span>
          </div>
        )}
      </div>
      {/* Active filter chips */}
      {filters.length > 0 && activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {filters.map((f) => {
            const v = (values as any)[f.id]
            if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) return null
            const toLabel = (val: any) => {
              if (typeof f.formatValue === 'function' && (typeof val === 'string' || typeof val === 'number')) {
                const formatted = f.formatValue(String(val))
                if (formatted) return formatted
              }
              if ((f.type === 'select' || f.type === 'combobox') && f.options) {
                const o = f.options.find((o) => o.value === val)
                return o ? o.label : String(val)
              }
              if (typeof val === 'object' && val != null && !Array.isArray(val)) {
                if (val.from == null && val.to == null) return null
                if (typeof f.formatRangeValue === 'function') {
                  const formatted = f.formatRangeValue(val as { from?: string; to?: string })
                  if (formatted) return formatted
                }
                const formatPart = (raw: unknown): string => {
                  if (typeof raw !== 'string' || !raw.trim()) return ''
                  const value = raw.trim()
                  // datetime-local: YYYY-MM-DDTHH:mm (seconds optional) — format without depending on Date parse quirks
                  const dateTimeMatch = value.match(
                    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?$/,
                  )
                  if (dateTimeMatch) {
                    const [, year, month, day, hour, minute] = dateTimeMatch
                    if (f.dateTime || hour != null) {
                      return `${day}.${month}.${year}, ${hour ?? '00'}:${minute ?? '00'}`
                    }
                    return `${day}.${month}.${year}`
                  }
                  const normalized =
                    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00` : value
                  const parsed = new Date(normalized)
                  if (Number.isNaN(parsed.getTime())) return value
                  if (f.dateTime || value.includes('T')) {
                    return parsed.toLocaleString(undefined, {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  }
                  return parsed.toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                  })
                }
                const from = formatPart(val.from)
                const to = formatPart(val.to)
                if (from && to) return `${from} → ${to}`
                return from || to
              }
              if (val === true) return t('common.yes', 'Yes')
              if (val === false) return t('common.no', 'No')
              return String(val)
            }
            const removeValue = (val?: any) => {
              const next = { ...(values || {}) }
              if (Array.isArray(v) && val !== undefined) next[f.id] = v.filter((x: any) => x !== val)
              else delete (next as any)[f.id]
              onApply?.(next)
            }
            if (Array.isArray(v)) {
              return v.map((item) => (
                <Button key={`${f.id}:${item}`} size="sm" variant="outline" className="max-w-[calc(100vw-4rem)] truncate" onClick={() => removeValue(item)}>
                  {f.label}: {toLabel(item)} ×
                </Button>
              ))
            }
            const label = toLabel(v)
            if (!label) return null
            return (
              <Button key={f.id} size="sm" variant="outline" className="max-w-[calc(100vw-4rem)] truncate" onClick={() => removeValue()}>
                {f.label}: {label} ×
              </Button>
            )
          })}
        </div>
      )}
      <FilterOverlay
        title={t('ui.filterOverlay.title', 'Filters')}
        filters={filters}
        initialValues={values}
        open={open}
        onOpenChange={setOpen}
        onApply={(v) => onApply?.(v)}
        onClear={onClear}
        extraContent={filtersExtraContent}
      />
    </div>
  )
}

export type { FilterDef, FilterValues } from './FilterOverlay'
