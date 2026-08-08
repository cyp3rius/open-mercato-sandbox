"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { EntitySearchCombobox } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import type { EntitySearchComboboxOption } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'

type ResourceTypeRow = { id: string; name: string }

type ResourceTypesResponse = { items?: ResourceTypeRow[] }

function mergeOption(
  options: EntitySearchComboboxOption[],
  value: string,
  label: string,
): EntitySearchComboboxOption[] {
  if (!value.trim()) return options
  if (options.some((row) => row.value === value)) return options
  return [{ value, label: label || value }, ...options]
}

export function ResourceTypeSearchField({
  value,
  onChange,
  disabled = false,
}: {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
}) {
  const t = useT()
  const [label, setLabel] = React.useState('')

  React.useEffect(() => {
    let cancelled = false
    const trimmed = value.trim()
    if (!trimmed.length) {
      setLabel('')
      return
    }
    void (async () => {
      const call = await apiCall<ResourceTypesResponse>(
        `/api/resources/resource-types?page=1&pageSize=100`,
      )
      if (cancelled) return
      const row = (call.result?.items ?? []).find((item) => item.id === trimmed)
      setLabel(row?.name ?? trimmed)
    })()
    return () => {
      cancelled = true
    }
  }, [value])

  return (
    <EntitySearchCombobox
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="min-w-0 w-full"
      options={mergeOption([], value, label || value)}
      selectedDisplayOverride={label || undefined}
      onRemoteSearch={async (query) => {
        const params = new URLSearchParams({ page: '1', pageSize: '50' })
        const q = query?.trim()
        if (q?.length) params.set('search', q)
        const call = await apiCall<ResourceTypesResponse>(`/api/resources/resource-types?${params}`)
        const rows = (call.result?.items ?? []).map((item) => ({
          value: item.id,
          label: item.name,
        }))
        return mergeOption(rows, value, label || value)
      }}
      placeholder={t('taxi_fleet.config.fleet.resourceTypePlaceholder', 'Select resource type…')}
      searchPlaceholder={t('taxi_fleet.config.fleet.resourceTypeSearch', 'Search resource types…')}
      emptyText={t('taxi_fleet.config.fleet.resourceTypeEmpty', 'No resource types found.')}
    />
  )
}
