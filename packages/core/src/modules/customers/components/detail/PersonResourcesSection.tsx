"use client"

import * as React from 'react'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { Switch } from '@open-mercato/ui/primitives/switch'
import { apiCallOrThrow, readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { LookupSelect, type LookupSelectItem } from '@open-mercato/ui/backend/inputs'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import {
  DictionaryEntrySelect,
  type DictionaryOption,
  type DictionarySelectLabels,
} from '@open-mercato/core/modules/dictionaries/components/DictionaryEntrySelect'
import {
  RESOURCES_RESOURCE_FIELDSET_VEHICLE,
  resolveResourcesResourceFieldsetCode,
} from '@open-mercato/core/modules/resources/lib/resourceCustomFields'

type ResourceRow = {
  id: string
  name?: string | null
  resource_type_id?: string | null
  resourceTypeId?: string | null
  resource_type_name?: string | null
  customer_entity_id?: string | null
  customerEntityId?: string | null
}

type AccessoryLinkItem = {
  accessoryResourceId: string | null
}

const I18N_PREFIX = 'customers.people.detail.resources'

function chunkIds(ids: string[], size: number): string[][] {
  const unique = [...new Set(ids.filter((id) => id.length > 0))]
  const chunks: string[][] = []
  for (let index = 0; index < unique.length; index += size) {
    chunks.push(unique.slice(index, index + size))
  }
  return chunks
}

async function fetchResourcesByIds(
  ids: string[],
  errorMessage: string,
): Promise<ResourceRow[]> {
  if (ids.length === 0) return []
  const chunks = chunkIds(ids, 100)
  const merged: ResourceRow[] = []
  for (const chunk of chunks) {
    const params = new URLSearchParams({ page: '1', pageSize: '100', ids: chunk.join(',') })
    const res = await readApiResultOrThrow<{ items?: ResourceRow[] }>(
      `/api/resources/resources?${params.toString()}`,
      undefined,
      { errorMessage },
    )
    merged.push(...(Array.isArray(res?.items) ? res.items : []))
  }
  return merged
}

function isVehicleRow(row: ResourceRow): boolean {
  const tname = row.resource_type_name ?? null
  return resolveResourcesResourceFieldsetCode(tname) === RESOURCES_RESOURCE_FIELDSET_VEHICLE
}

function rowTypeId(row: ResourceRow): string | null {
  const raw = row.resource_type_id ?? row.resourceTypeId ?? null
  return typeof raw === 'string' && raw.length > 0 ? raw : null
}

function directCustomerId(row: ResourceRow): string | null {
  const raw = row.customer_entity_id ?? row.customerEntityId ?? null
  return typeof raw === 'string' && raw.length > 0 ? raw : null
}

export type PersonResourcesSectionProps = {
  customerEntityId: string
  translate?: (key: string, fallback?: string) => string
}

export function PersonResourcesSection({ customerEntityId, translate }: PersonResourcesSectionProps) {
  const tHook = useT()
  const tr = React.useCallback(
    (key: string, fallback?: string) => (translate ? translate(key, fallback) : tHook(key, fallback)),
    [tHook, translate],
  )
  const trRef = React.useRef(tr)
  trRef.current = tr

  const [filterText, setFilterText] = React.useState('')
  const [filterResourceType, setFilterResourceType] = React.useState('')
  const [onlyVehicleAccessories, setOnlyVehicleAccessories] = React.useState(true)

  const [items, setItems] = React.useState<ResourceRow[]>([])
  const [vehicleAccessoryIds, setVehicleAccessoryIds] = React.useState<Set<string>>(() => new Set())
  const [extraAccessoryRows, setExtraAccessoryRows] = React.useState<ResourceRow[]>([])
  const [loading, setLoading] = React.useState(false)
  const [pickerKey, setPickerKey] = React.useState(0)

  const loadLinked = React.useCallback(async () => {
    const translateMessage = trRef.current
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: '1',
        pageSize: '100',
        customerEntityId,
      })
      const res = await readApiResultOrThrow<{ items?: ResourceRow[] }>(
        `/api/resources/resources?${params.toString()}`,
        undefined,
        { errorMessage: translateMessage(`${I18N_PREFIX}.errorLoad`, 'Failed to load resources.') },
      )
      const nextItems = Array.isArray(res?.items) ? res.items : []
      setItems(nextItems)

      const vehicles = nextItems.filter(isVehicleRow)
      const accIdSet = new Set<string>()
      for (const vehicle of vehicles) {
        try {
          const linkRes = await readApiResultOrThrow<{ items?: AccessoryLinkItem[] }>(
            `/api/resources/resource-accessory-links?hostResourceId=${encodeURIComponent(vehicle.id)}`,
            undefined,
            {
              errorMessage: translateMessage(
                `${I18N_PREFIX}.errorLoadAccessoryLinks`,
                'Failed to load vehicle accessories.',
              ),
            },
          )
          for (const link of linkRes?.items ?? []) {
            if (typeof link.accessoryResourceId === 'string' && link.accessoryResourceId.length > 0) {
              accIdSet.add(link.accessoryResourceId)
            }
          }
        } catch {
          /* skip vehicle */
        }
      }
      setVehicleAccessoryIds(accIdSet)

      const linkedIds = new Set(nextItems.map((row) => row.id))
      const missingIds = [...accIdSet].filter((id) => !linkedIds.has(id))
      if (missingIds.length === 0) {
        setExtraAccessoryRows([])
      } else {
        const extra = await fetchResourcesByIds(
          missingIds,
          translateMessage(`${I18N_PREFIX}.errorLoad`, 'Failed to load resources.'),
        )
        setExtraAccessoryRows(extra)
      }
    } catch {
      setItems([])
      setVehicleAccessoryIds(new Set())
      setExtraAccessoryRows([])
    } finally {
      setLoading(false)
    }
  }, [customerEntityId])

  React.useEffect(() => {
    loadLinked().catch(() => {})
  }, [loadLinked])

  const resourceTypeLabels = React.useMemo<DictionarySelectLabels>(
    () => ({
      placeholder: tr(`${I18N_PREFIX}.filters.resourceTypePlaceholder`, 'All types'),
      addLabel: tr(`${I18N_PREFIX}.filters.dictionary.add`, 'Add'),
      addPrompt: tr(`${I18N_PREFIX}.filters.dictionary.prompt`, 'Name'),
      dialogTitle: tr(`${I18N_PREFIX}.filters.dictionary.dialogTitle`, 'Add entry'),
      valueLabel: tr(`${I18N_PREFIX}.filters.dictionary.valueLabel`, 'Name'),
      valuePlaceholder: tr(`${I18N_PREFIX}.filters.dictionary.valuePlaceholder`, 'Name'),
      labelLabel: tr(`${I18N_PREFIX}.filters.dictionary.labelLabel`, 'Label'),
      labelPlaceholder: tr(`${I18N_PREFIX}.filters.dictionary.labelPlaceholder`, 'Display name'),
      emptyError: tr(`${I18N_PREFIX}.filters.dictionary.emptyError`, 'Please enter a name'),
      cancelLabel: tr(`${I18N_PREFIX}.filters.dictionary.cancel`, 'Cancel'),
      saveLabel: tr(`${I18N_PREFIX}.filters.dictionary.save`, 'Save'),
      saveShortcutHint: tr(`${I18N_PREFIX}.filters.dictionary.saveShortcut`, '\u2318/Ctrl + Enter'),
      errorLoad: tr(`${I18N_PREFIX}.filters.dictionary.errorLoad`, 'Failed to load options'),
      errorSave: tr(`${I18N_PREFIX}.filters.dictionary.errorSave`, 'Failed to save option'),
      loadingLabel: tr(`${I18N_PREFIX}.filters.dictionary.loading`, 'Loading…'),
      manageTitle: tr(`${I18N_PREFIX}.filters.dictionary.manage`, 'Manage resource types'),
    }),
    [tr],
  )

  const fetchResourceTypeOptions = React.useCallback(async (): Promise<DictionaryOption[]> => {
    const params = new URLSearchParams({ page: '1', pageSize: '100' })
    const res = await readApiResultOrThrow<{ items?: Array<Record<string, unknown>> }>(
      `/api/resources/resource-types?${params.toString()}`,
      undefined,
      {
        errorMessage: trRef.current(
          `${I18N_PREFIX}.filters.errorLoadTypes`,
          'Failed to load resource types.',
        ),
      },
    )
    const rows = Array.isArray(res?.items) ? res.items : []
    return rows
      .map((row) => {
        const id = typeof row.id === 'string' ? row.id : ''
        const name = typeof row.name === 'string' ? row.name : ''
        const color = (row.appearance_color ?? row.appearanceColor ?? null) as string | null
        const icon = (row.appearance_icon ?? row.appearanceIcon ?? null) as string | null
        return { id, name, color, icon }
      })
      .filter((row) => row.id.length > 0)
      .map((row) => ({
        value: row.id,
        label: row.name.trim().length ? row.name.trim() : row.id,
        color: row.color,
        icon: row.icon,
      }))
  }, [])

  const hasActiveFilters = Boolean(
    filterText.trim() || filterResourceType.trim() || !onlyVehicleAccessories,
  )

  const clearFilters = React.useCallback(() => {
    setFilterText('')
    setFilterResourceType('')
    setOnlyVehicleAccessories(true)
  }, [])

  const filterLower = filterText.trim().toLowerCase()
  const matchesFilter = React.useCallback(
    (row: ResourceRow) => {
      if (filterResourceType.trim()) {
        const tid = rowTypeId(row)
        if (tid !== filterResourceType.trim()) return false
      }
      if (!filterLower) return true
      const name = typeof row.name === 'string' ? row.name.toLowerCase() : ''
      const tname = typeof row.resource_type_name === 'string' ? row.resource_type_name.toLowerCase() : ''
      return name.includes(filterLower) || tname.includes(filterLower)
    },
    [filterLower, filterResourceType],
  )

  const vehicles = React.useMemo(() => items.filter(isVehicleRow), [items])

  const accessories = React.useMemo(() => {
    const byId = new Map<string, ResourceRow>()
    for (const row of items) {
      if (!isVehicleRow(row)) byId.set(row.id, row)
    }
    for (const row of extraAccessoryRows) {
      if (!byId.has(row.id) && !isVehicleRow(row)) byId.set(row.id, row)
    }
    const merged = Array.from(byId.values())
    if (onlyVehicleAccessories) {
      return merged.filter((row) => vehicleAccessoryIds.has(row.id) && !isVehicleRow(row))
    }
    return items.filter((row) => !isVehicleRow(row))
  }, [extraAccessoryRows, items, onlyVehicleAccessories, vehicleAccessoryIds])

  const linkResource = React.useCallback(
    async (resourceId: string | null) => {
      if (!resourceId) return
      await apiCallOrThrow(
        '/api/resources/resources',
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: resourceId, customerEntityId }),
        },
        { errorMessage: tr(`${I18N_PREFIX}.errorLink`, 'Failed to link resource.') },
      )
      flash(tr(`${I18N_PREFIX}.linked`, 'Resource linked.'), 'success')
      setPickerKey((k) => k + 1)
      await loadLinked()
    },
    [customerEntityId, loadLinked, tr],
  )

  const unlinkResource = React.useCallback(
    async (resourceId: string) => {
      await apiCallOrThrow(
        '/api/resources/resources',
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: resourceId, customerEntityId: null }),
        },
        { errorMessage: tr(`${I18N_PREFIX}.errorUnlink`, 'Failed to unlink resource.') },
      )
      flash(tr(`${I18N_PREFIX}.unlinked`, 'Resource unlinked.'), 'success')
      await loadLinked()
    },
    [loadLinked, tr],
  )

  const fetchCandidates = React.useCallback(
    async (query: string): Promise<LookupSelectItem[]> => {
      const params = new URLSearchParams({ page: '1', pageSize: '30' })
      if (query.trim()) params.set('search', query.trim())
      const res = await readApiResultOrThrow<{ items?: ResourceRow[] }>(
        `/api/resources/resources?${params.toString()}`,
        undefined,
        { errorMessage: tr(`${I18N_PREFIX}.errorSearch`, 'Failed to search resources.') },
      )
      const rows = Array.isArray(res?.items) ? res.items : []
      return rows
        .filter((row) => {
          const linked = directCustomerId(row)
          return !linked || linked === customerEntityId
        })
        .map((row) => ({
          id: row.id,
          title: typeof row.name === 'string' && row.name.trim().length ? row.name.trim() : row.id,
          subtitle: row.resource_type_name ?? null,
        }))
    },
    [customerEntityId, tr],
  )

  const renderList = (rows: ResourceRow[], emptyLabel: string, options: { filteredEmpty?: boolean } = {}) => {
    const visible = rows.filter(matchesFilter)
    if (loading) {
      return <p className="text-sm text-muted-foreground">{tr('ui.loading', 'Loading…')}</p>
    }
    if (options.filteredEmpty && visible.length === 0 && hasActiveFilters) {
      return (
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/5 px-4 py-8 text-center">
          <p className="text-sm font-medium text-foreground">
            {tr(`${I18N_PREFIX}.emptyFilteredTitle`, 'No resources match the filters.')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {tr(`${I18N_PREFIX}.emptyFilteredHint`, 'Adjust filters or clear them to see all matching resources.')}
          </p>
          <Button type="button" size="sm" variant="outline" className="mt-4" onClick={() => clearFilters()}>
            {tr(`${I18N_PREFIX}.filters.clear`, 'Clear filters')}
          </Button>
        </div>
      )
    }
    if (!visible.length) {
      return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
    }
    return (
      <ul className="divide-y rounded-md border">
        {visible.map((row) => {
          const linkedHere = directCustomerId(row) === customerEntityId
          return (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div>
                <div className="text-sm font-medium">
                  {typeof row.name === 'string' && row.name.trim().length ? row.name : row.id}
                </div>
                {row.resource_type_name ? (
                  <div className="text-xs text-muted-foreground">{row.resource_type_name}</div>
                ) : null}
                {!linkedHere && onlyVehicleAccessories ? (
                  <div className="text-xs text-muted-foreground">
                    {tr(`${I18N_PREFIX}.viaVehicle`, 'Linked via a vehicle only')}
                  </div>
                ) : null}
                <a
                  className="text-xs text-primary underline-offset-2 hover:underline"
                  href={`/backend/resources/resources/${encodeURIComponent(row.id)}`}
                >
                  {tr(`${I18N_PREFIX}.open`, 'Open')}
                </a>
              </div>
              {linkedHere ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => void unlinkResource(row.id)}>
                  {tr(`${I18N_PREFIX}.unlink`, 'Unlink')}
                </Button>
              ) : null}
            </li>
          )
        })}
      </ul>
    )
  }

  const accessoriesEmptyDefault =
    onlyVehicleAccessories && vehicles.length === 0
      ? tr(`${I18N_PREFIX}.emptyAccessoriesNeedVehicles`, 'Link a vehicle to see its accessories here.')
      : onlyVehicleAccessories && vehicleAccessoryIds.size === 0
        ? tr(`${I18N_PREFIX}.emptyAccessoriesNoLinks`, 'No accessories are linked to the vehicles yet.')
        : tr(`${I18N_PREFIX}.emptyAccessories`, 'No other resources linked.')

  return (
    <div className="space-y-6">
      <div className="space-y-2 rounded-lg border border-border/50 bg-muted/5 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {tr(`${I18N_PREFIX}.filters.heading`, 'Filters')}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="min-w-0 space-y-1">
            <div className="text-[10px] font-medium text-muted-foreground">
              {tr(`${I18N_PREFIX}.filter`, 'Filter lists')}
            </div>
            <Input
              id="customer-entity-resources-filter"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder={tr(`${I18N_PREFIX}.filterPlaceholder`, 'Name or type…')}
              aria-label={tr(`${I18N_PREFIX}.filter`, 'Filter lists')}
            />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="text-[10px] font-medium text-muted-foreground">
              {tr(`${I18N_PREFIX}.filters.resourceType`, 'Resource type')}
            </div>
            <DictionaryEntrySelect
              value={filterResourceType || undefined}
              onChange={(next) => setFilterResourceType(next ?? '')}
              fetchOptions={fetchResourceTypeOptions}
              labels={resourceTypeLabels}
              allowInlineCreate={false}
              selectClassName="w-full"
              manageHref="/backend/resources/resource-types"
              showManage
            />
          </div>
          <div className="flex min-w-0 items-end gap-3 pb-0.5">
            <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-md border border-border/40 bg-background/50 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <Label
                  htmlFor="only-vehicle-accessories"
                  className="cursor-pointer text-xs font-medium leading-snug text-foreground"
                >
                  {tr(`${I18N_PREFIX}.filters.onlyVehicleAccessories`, 'Only accessories of linked vehicles')}
                </Label>
                <Switch
                  id="only-vehicle-accessories"
                  checked={onlyVehicleAccessories}
                  onCheckedChange={(next) => setOnlyVehicleAccessories(Boolean(next))}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                {tr(
                  `${I18N_PREFIX}.filters.onlyVehicleAccessoriesHint`,
                  'When on, the list below shows resources attached as accessories to vehicles linked to this record. Turn off to list every non-vehicle resource linked directly.',
                )}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" disabled={!hasActiveFilters || loading} onClick={() => clearFilters()}>
            {tr(`${I18N_PREFIX}.filters.clear`, 'Clear filters')}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/15 p-4 space-y-3">
        <div className="text-xs font-semibold uppercase text-muted-foreground">
          {tr(`${I18N_PREFIX}.linkNew`, 'Link resource')}
        </div>
        <LookupSelect
          key={pickerKey}
          value={null}
          onChange={(next) => {
            if (next) void linkResource(next)
          }}
          fetchItems={fetchCandidates}
          minQuery={0}
          placeholder={tr(`${I18N_PREFIX}.searchPlaceholder`, 'Search resources…')}
          emptyLabel={tr(`${I18N_PREFIX}.searchEmpty`, 'No resources found.')}
          clearLabel={tr(`${I18N_PREFIX}.clear`, 'Clear')}
        />
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{tr(`${I18N_PREFIX}.vehicles`, 'Vehicles')}</h3>
        {renderList(vehicles, tr(`${I18N_PREFIX}.emptyVehicles`, 'No vehicle resources linked.'), {
          filteredEmpty: true,
        })}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">
          {tr(`${I18N_PREFIX}.accessories`, 'Accessories and other resources')}
        </h3>
        {renderList(accessories, accessoriesEmptyDefault, { filteredEmpty: true })}
      </section>
    </div>
  )
}
