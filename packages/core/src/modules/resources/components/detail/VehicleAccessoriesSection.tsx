"use client"

import * as React from 'react'
import Link from 'next/link'
import { ExternalLink, Loader2, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@open-mercato/ui/primitives/button'
import { Checkbox } from '@open-mercato/ui/primitives/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@open-mercato/ui/primitives/dialog'
import { Switch } from '@open-mercato/ui/primitives/switch'
import { apiCallOrThrow, readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import type { LookupSelectItem } from '@open-mercato/ui/backend/inputs'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import {
  RESOURCES_RESOURCE_FIELDSET_VEHICLE,
  resolveResourcesResourceFieldsetCode,
} from '@open-mercato/core/modules/resources/lib/resourceCustomFields'
import { renderDictionaryColor, renderDictionaryIcon } from '@open-mercato/core/modules/dictionaries/components/dictionaryAppearance'

type LinkRow = {
  id: string
  isMounted: boolean
  accessoryResourceId: string | null
  accessoryName: string | null
  accessoryResourceTypeId?: string | null
  accessoryAppearanceIcon?: string | null
  accessoryAppearanceColor?: string | null
}

type ResourceListItem = {
  id: string
  name?: string | null
  resource_type_id?: string | null
  resourceTypeId?: string | null
  resource_type_name?: string | null
}

type ResourceTypeMeta = {
  name: string
  appearanceIcon: string | null
  appearanceColor: string | null
}

function readTypeRowMeta(row: Record<string, unknown>): ResourceTypeMeta | null {
  const id = typeof row.id === 'string' ? row.id : ''
  const name = typeof row.name === 'string' && row.name.length ? row.name : ''
  if (!id || !name) return null
  const appearanceIconRaw = row.appearanceIcon ?? row.appearance_icon
  const appearanceColorRaw = row.appearanceColor ?? row.appearance_color
  const appearanceIcon = typeof appearanceIconRaw === 'string' && appearanceIconRaw.length ? appearanceIconRaw : null
  const appearanceColor = typeof appearanceColorRaw === 'string' && appearanceColorRaw.length ? appearanceColorRaw : null
  return { name, appearanceIcon, appearanceColor }
}

function AccessoryMultiLookup({
  fetchItems,
  selectedIds,
  onToggle,
  searchPlaceholder,
  emptyLabel,
  loadingLabel,
}: {
  fetchItems: (query: string) => Promise<LookupSelectItem[]>
  selectedIds: Set<string>
  onToggle: (id: string) => void
  searchPlaceholder: string
  emptyLabel: string
  loadingLabel: string
}) {
  const [query, setQuery] = React.useState('')
  const [items, setItems] = React.useState<LookupSelectItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const fetchRef = React.useRef(fetchItems)
  React.useEffect(() => {
    fetchRef.current = fetchItems
  }, [fetchItems])

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      fetchRef
        .current(query.trim())
        .then((result) => {
          if (!cancelled) setItems(result)
        })
        .catch(() => {
          if (!cancelled) setItems([])
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 220)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  return (
    <div className="space-y-3">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          className="w-full rounded border py-2 pl-8 pr-2 text-sm"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
        />
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingLabel}
        </div>
      ) : null}
      {!loading && !items.length ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : null}
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {items.map((item) => {
          const selected = selectedIds.has(item.id)
          const disabled = Boolean(item.disabled)
          const toggle = () => {
            if (disabled) return
            onToggle(item.id)
          }
          return (
            <div
              key={item.id}
              role="button"
              tabIndex={disabled ? -1 : 0}
              className={cn(
                'flex cursor-pointer gap-3 rounded border bg-card p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                selected ? 'border-primary/70 bg-primary/5' : 'hover:border-primary/50',
                disabled && 'cursor-not-allowed opacity-50',
              )}
              onClick={toggle}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  toggle()
                }
              }}
              aria-pressed={selected}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center sm:h-12 sm:w-12"
                onClick={(event) => event.stopPropagation()}
              >
                <Checkbox
                  checked={selected}
                  disabled={disabled}
                  onCheckedChange={() => {
                    if (!disabled) onToggle(item.id)
                  }}
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{item.title}</div>
                    {item.subtitle ? (
                      <div className="truncate text-xs text-muted-foreground">{item.subtitle}</div>
                    ) : null}
                    {item.description ? (
                      <div className="truncate text-xs text-muted-foreground">{item.description}</div>
                    ) : null}
                  </div>
                  {item.rightLabel ? (
                    <div className="shrink-0 text-xs font-medium text-muted-foreground">{item.rightLabel}</div>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function VehicleAccessoriesSection({ hostResourceId }: { hostResourceId: string | null }) {
  const t = useT()
  const [links, setLinks] = React.useState<LinkRow[]>([])
  const [loading, setLoading] = React.useState(false)
  const [typeById, setTypeById] = React.useState<Map<string, ResourceTypeMeta>>(() => new Map())
  const [addDialogOpen, setAddDialogOpen] = React.useState(false)
  const [dialogLookupKey, setDialogLookupKey] = React.useState(0)
  const [selectedAccessoryIds, setSelectedAccessoryIds] = React.useState<Set<string>>(() => new Set())
  const [attaching, setAttaching] = React.useState(false)

  const loadTypes = React.useCallback(async () => {
    const params = new URLSearchParams({ page: '1', pageSize: '100' })
    const res = await readApiResultOrThrow<{ items?: Record<string, unknown>[] }>(
      `/api/resources/resource-types?${params.toString()}`,
      undefined,
      { errorMessage: t('resources.accessories.error.loadTypes', 'Failed to load resource types.') },
    )
    const items = Array.isArray(res?.items) ? res.items : []
    const map = new Map<string, ResourceTypeMeta>()
    items.forEach((raw) => {
      const meta = readTypeRowMeta(raw)
      if (meta) {
        const id = typeof raw.id === 'string' ? raw.id : ''
        if (id) map.set(id, meta)
      }
    })
    setTypeById(map)
  }, [t])

  const isNonVehicleTypeId = React.useCallback(
    (resourceTypeId: string | null | undefined) => {
      if (!resourceTypeId) return true
      const meta = typeById.get(resourceTypeId) ?? null
      const name = meta?.name ?? null
      if (!name) return true
      return resolveResourcesResourceFieldsetCode(name) !== RESOURCES_RESOURCE_FIELDSET_VEHICLE
    },
    [typeById],
  )

  const loadLinks = React.useCallback(async () => {
    if (!hostResourceId) return
    setLoading(true)
    try {
      const res = await readApiResultOrThrow<{ items?: LinkRow[] }>(
        `/api/resources/resource-accessory-links?hostResourceId=${encodeURIComponent(hostResourceId)}`,
        undefined,
        { errorMessage: t('resources.accessories.error.load', 'Failed to load accessories.') },
      )
      setLinks(Array.isArray(res?.items) ? res.items : [])
    } catch {
      setLinks([])
    } finally {
      setLoading(false)
    }
  }, [hostResourceId, t])

  React.useEffect(() => {
    loadTypes().catch(() => {})
  }, [loadTypes])

  React.useEffect(() => {
    loadLinks().catch(() => {})
  }, [loadLinks])

  const linkedAccessoryIds = React.useMemo(() => {
    const next = new Set<string>()
    links.forEach((row) => {
      const id = row.accessoryResourceId?.trim()
      if (id) next.add(id)
    })
    return next
  }, [links])

  const fetchAccessoryCandidates = React.useCallback(
    async (query: string): Promise<LookupSelectItem[]> => {
      const params = new URLSearchParams({ page: '1', pageSize: '30' })
      if (query.trim()) params.set('search', query.trim())
      const res = await readApiResultOrThrow<{ items?: ResourceListItem[] }>(
        `/api/resources/resources?${params.toString()}`,
        undefined,
        { errorMessage: t('resources.accessories.error.search', 'Failed to search resources.') },
      )
      const items = Array.isArray(res?.items) ? res.items : []
      return items
        .filter((row) => row.id !== hostResourceId)
        .filter((row) => {
          const tid = row.resourceTypeId ?? row.resource_type_id ?? null
          return isNonVehicleTypeId(tid)
        })
        .map((row) => ({
          id: row.id,
          title: typeof row.name === 'string' && row.name.trim().length ? row.name.trim() : row.id,
          subtitle: row.resource_type_name ?? null,
        }))
    },
    [hostResourceId, isNonVehicleTypeId, t],
  )

  const fetchDialogAccessoryItems = React.useCallback(
    async (query: string) => {
      const rows = await fetchAccessoryCandidates(query)
      return rows.filter((item) => !linkedAccessoryIds.has(item.id))
    },
    [fetchAccessoryCandidates, linkedAccessoryIds],
  )

  const toggleAccessorySelection = React.useCallback((id: string) => {
    setSelectedAccessoryIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const submitSelectedAccessories = React.useCallback(async () => {
    if (!hostResourceId) return
    const ids = [...selectedAccessoryIds]
    if (ids.length === 0) return
    setAttaching(true)
    try {
      for (const accessoryResourceId of ids) {
        await apiCallOrThrow(
          '/api/resources/resource-accessory-links',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ hostResourceId, accessoryResourceId, isMounted: false }),
          },
          { errorMessage: t('resources.accessories.error.save', 'Failed to link accessory.') },
        )
      }
      flash(
        t('resources.accessories.flash.linkedBatch', 'Added {{count}} accessories.', { count: ids.length }),
        'success',
      )
      setSelectedAccessoryIds(new Set())
      setAddDialogOpen(false)
      await loadLinks()
    } finally {
      setAttaching(false)
    }
  }, [hostResourceId, loadLinks, selectedAccessoryIds, t])

  const handleAddDialogKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        if (attaching || selectedAccessoryIds.size === 0) return
        void submitSelectedAccessories()
      }
    },
    [attaching, selectedAccessoryIds.size, submitSelectedAccessories],
  )

  const toggleMounted = React.useCallback(
    async (linkId: string, isMounted: boolean) => {
      await apiCallOrThrow(
        '/api/resources/resource-accessory-links',
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: linkId, isMounted }),
        },
        { errorMessage: t('resources.accessories.error.save', 'Failed to update.') },
      )
      setLinks((prev) => prev.map((row) => (row.id === linkId ? { ...row, isMounted } : row)))
    },
    [t],
  )

  const removeLink = React.useCallback(
    async (linkId: string) => {
      await apiCallOrThrow(
        `/api/resources/resource-accessory-links?id=${encodeURIComponent(linkId)}`,
        { method: 'DELETE' },
        { errorMessage: t('resources.accessories.error.delete', 'Failed to remove link.') },
      )
      flash(t('resources.accessories.flash.removed', 'Link removed.'), 'success')
      await loadLinks()
    },
    [loadLinks, t],
  )

  if (!hostResourceId) return null

  return (
    <div className="space-y-6">
      <div className="relative pe-12">
        <h2 className="text-sm font-semibold text-foreground">
          {t('resources.accessories.title', 'Accessories')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            'resources.accessories.subtitle',
            'Link non-vehicle resources and mark which are currently mounted on this vehicle.',
          )}
        </p>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="absolute end-0 top-0 shrink-0"
          aria-label={t('resources.accessories.add', 'Add accessory')}
          onClick={() => {
            setDialogLookupKey((key) => key + 1)
            setSelectedAccessoryIds(new Set())
            setAddDialogOpen(true)
          }}
        >
          <Plus className="size-4" aria-hidden />
        </Button>
      </div>

      <Dialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open)
          if (!open) {
            setSelectedAccessoryIds(new Set())
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl" onKeyDown={handleAddDialogKeyDown}>
          <DialogHeader>
            <DialogTitle>{t('resources.accessories.dialog.title', 'Add accessories')}</DialogTitle>
            <DialogDescription>
              {t(
                'resources.accessories.dialog.description',
                'Search for non-vehicle resources and select one or more to link to this vehicle.',
              )}
            </DialogDescription>
          </DialogHeader>
          <AccessoryMultiLookup
            key={dialogLookupKey}
            fetchItems={fetchDialogAccessoryItems}
            selectedIds={selectedAccessoryIds}
            onToggle={toggleAccessorySelection}
            searchPlaceholder={t('resources.accessories.search.placeholder', 'Search resources…')}
            emptyLabel={t('resources.accessories.search.empty', 'No matching resources.')}
            loadingLabel={t('resources.accessories.search.loading', 'Searching…')}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
              disabled={attaching}
            >
              {t('resources.accessories.dialog.cancel', 'Cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => void submitSelectedAccessories()}
              disabled={attaching || selectedAccessoryIds.size === 0}
            >
              {attaching ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  {t('resources.accessories.dialog.adding', 'Adding…')}
                </>
              ) : (
                t('resources.accessories.dialog.addSelected', 'Add selected')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('ui.loading', 'Loading…')}</p>
      ) : links.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('resources.accessories.empty', 'No accessories linked yet.')}</p>
      ) : (
        <ul className="space-y-4">
          {links.map((row) => {
            const accessoryId = row.accessoryResourceId?.trim() ?? ''
            const showOpen = accessoryId.length > 0
            const recordHref = `/backend/resources/resources/${encodeURIComponent(accessoryId)}`
            const typeId = row.accessoryResourceTypeId?.trim() ?? ''
            const typeMeta = typeId.length > 0 ? typeById.get(typeId) ?? null : null
            const displayIcon = row.accessoryAppearanceIcon ?? typeMeta?.appearanceIcon ?? null
            const displayColor = row.accessoryAppearanceColor ?? typeMeta?.appearanceColor ?? null
            return (
              <li
                key={row.id}
                className="relative rounded-md border border-border/60 bg-background/80 px-3 py-3 text-sm"
              >
                {showOpen ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    asChild
                    className="absolute end-3 top-3 z-10 shrink-0"
                  >
                    <Link
                      href={recordHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2"
                    >
                      <ExternalLink className="size-4 shrink-0" aria-hidden />
                      {t('common.open', 'Open')}
                    </Link>
                  </Button>
                ) : null}
                <div
                  className={`flex flex-wrap items-center justify-between gap-3 ${showOpen ? 'pe-28' : ''}`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex shrink-0 items-center gap-1.5">
                      {displayColor ? renderDictionaryColor(displayColor) : null}
                      {displayIcon ? renderDictionaryIcon(displayIcon) : null}
                    </div>
                    <div className="min-w-0 truncate font-medium text-sm">
                      {row.accessoryName && row.accessoryName.trim().length
                        ? row.accessoryName
                        : row.accessoryResourceId}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={row.isMounted}
                        onCheckedChange={(checked) => {
                          void toggleMounted(row.id, checked)
                        }}
                      />
                      {t('resources.accessories.mounted', 'Mounted')}
                    </label>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      aria-label={t('resources.accessories.remove', 'Remove')}
                      onClick={() => void removeLink(row.id)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
