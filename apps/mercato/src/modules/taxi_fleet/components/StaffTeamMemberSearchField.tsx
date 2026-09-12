"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { EntitySearchCombobox } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import {
  mergeEntitySearchOption,
  remoteSearchStaffTeamMembers,
  resolveStaffTeamMemberDisplayLabel,
} from '../lib/staffTeamMemberSearch'

type StaffTeamMemberSearchFieldProps = {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  excludeMemberIds?: Set<string>
}

export function StaffTeamMemberSearchField({
  value,
  onChange,
  disabled = false,
  excludeMemberIds,
}: StaffTeamMemberSearchFieldProps) {
  const t = useT()
  const [label, setLabel] = React.useState('')

  React.useEffect(() => {
    let cancelled = false
    const trimmed = value.trim()
    if (!trimmed.length) {
      setLabel('')
      return
    }
    void resolveStaffTeamMemberDisplayLabel(trimmed).then((resolved) => {
      if (!cancelled) setLabel(resolved ?? trimmed)
    })
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
      options={mergeEntitySearchOption([], value, label || value)}
      selectedDisplayOverride={label || undefined}
      onRemoteSearch={async (query) => {
        const rows = await remoteSearchStaffTeamMembers(query, { excludeMemberIds })
        return mergeEntitySearchOption(rows, value, label || value)
      }}
      placeholder={t('taxi_fleet.drivers.pickStaffPlaceholder', 'Select employee…')}
      searchPlaceholder={t('taxi_fleet.drivers.staffMemberSearch', 'Search employee…')}
      emptyText={t('taxi_fleet.drivers.staffMemberEmpty', 'No employees found.')}
    />
  )
}
