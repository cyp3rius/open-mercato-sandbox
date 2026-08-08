"use client"

import * as React from 'react'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

type ResourceItem = {
  id?: string
  name?: string
  title?: string
  appearanceColor?: string | null
  appearance_color?: string | null
  resourceTypeId?: string | null
  resource_type_id?: string | null
}

type ResourceTypeItem = {
  id?: string
  appearanceColor?: string | null
  appearance_color?: string | null
}

type ResourcesResponse = { items: ResourceItem[] }
type ResourceTypesResponse = { items: ResourceTypeItem[] }

export function normalizeAppearanceHex(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw.length) return null
  if (/^rgba?\(/i.test(raw)) return raw
  const hex = raw.startsWith('#') ? raw.slice(1) : raw
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${hex
      .split('')
      .map((char) => char + char)
      .join('')
      .toLowerCase()}`
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex.toLowerCase()}`
  if (/^[0-9a-fA-F]{8}$/.test(hex)) return `#${hex.slice(0, 6).toLowerCase()}`
  return null
}

function readAppearanceColor(item: ResourceItem | ResourceTypeItem): string | null {
  return (
    normalizeAppearanceHex(item.appearanceColor) ??
    normalizeAppearanceHex(item.appearance_color)
  )
}

function readResourceTypeId(item: ResourceItem): string | null {
  if (typeof item.resourceTypeId === 'string' && item.resourceTypeId.trim()) return item.resourceTypeId.trim()
  if (typeof item.resource_type_id === 'string' && item.resource_type_id.trim()) return item.resource_type_id.trim()
  return null
}

export function useResourceLabels(resourceIds: string[]) {
  const [labels, setLabels] = React.useState<Record<string, string>>({})
  const [colors, setColors] = React.useState<Record<string, string>>({})

  const idsKey = React.useMemo(
    () => [...new Set(resourceIds.filter(Boolean))].sort().join(','),
    [resourceIds],
  )

  React.useEffect(() => {
    const uniqueIds = idsKey.split(',').filter(Boolean)
    if (!uniqueIds.length) {
      setLabels({})
      setColors({})
      return
    }
    let cancelled = false
    async function load() {
      const params = new URLSearchParams({ page: '1', pageSize: '100', ids: uniqueIds.join(',') })
      const call = await apiCall<ResourcesResponse>(`/api/resources/resources?${params}`)
      if (cancelled) return
      const nextLabels: Record<string, string> = {}
      const nextColors: Record<string, string> = {}
      const typeIdsNeeded = new Set<string>()
      const pendingByType = new Map<string, string[]>()
      const items = Array.isArray(call.result?.items) ? call.result.items : []
      items.forEach((item) => {
        const id = typeof item.id === 'string' ? item.id : null
        if (!id) return
        const label =
          typeof item.name === 'string'
            ? item.name
            : typeof item.title === 'string'
              ? item.title
              : null
        if (label) nextLabels[id] = label
        const color = readAppearanceColor(item)
        if (color) {
          nextColors[id] = color
          return
        }
        const typeId = readResourceTypeId(item)
        if (!typeId) return
        typeIdsNeeded.add(typeId)
        const list = pendingByType.get(typeId) ?? []
        list.push(id)
        pendingByType.set(typeId, list)
      })

      if (typeIdsNeeded.size > 0) {
        const typeParams = new URLSearchParams({
          page: '1',
          pageSize: '100',
          ids: [...typeIdsNeeded].join(','),
        })
        const typeCall = await apiCall<ResourceTypesResponse>(`/api/resources/resource-types?${typeParams}`)
        if (!cancelled) {
          const typeItems = Array.isArray(typeCall.result?.items) ? typeCall.result.items : []
          typeItems.forEach((typeItem) => {
            const typeId = typeof typeItem.id === 'string' ? typeItem.id : null
            if (!typeId) return
            const typeColor = readAppearanceColor(typeItem)
            if (!typeColor) return
            for (const resourceId of pendingByType.get(typeId) ?? []) {
              if (!nextColors[resourceId]) nextColors[resourceId] = typeColor
            }
          })
        }
      }

      if (cancelled) return
      setLabels(nextLabels)
      setColors(nextColors)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [idsKey])

  const resolveLabel = React.useCallback((resourceId: string) => labels[resourceId] ?? resourceId, [labels])
  const resolveColor = React.useCallback((resourceId: string) => colors[resourceId] ?? null, [colors])

  return { labels, colors, resolveLabel, resolveColor }
}
