'use client'

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import {
  DictionaryEntrySelect,
  type DictionaryOption,
  type DictionarySelectLabels,
} from '@open-mercato/core/modules/dictionaries/components/DictionaryEntrySelect'

export const ASSIGNMENT_STATUSES = ['planned', 'confirmed', 'completed', 'cancelled'] as const
export type AssignmentStatusCode = (typeof ASSIGNMENT_STATUSES)[number]

const ASSIGNMENT_STATUS_COLORS: Record<AssignmentStatusCode, string> = {
  planned: '#94a3b8',
  confirmed: '#10b981',
  completed: '#059669',
  cancelled: '#94a3b8',
}

type AssignmentStatusFieldProps = {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
}

export function AssignmentStatusField({
  value,
  onChange,
  disabled = false,
}: AssignmentStatusFieldProps) {
  const t = useT()

  const fetchOptions = React.useCallback(async (): Promise<DictionaryOption[]> => {
    return ASSIGNMENT_STATUSES.map((code) => ({
      value: code,
      label: t(`taxi_fleet.assignments.statuses.${code}`, code),
      color: ASSIGNMENT_STATUS_COLORS[code],
      icon: null,
    }))
  }, [t])

  const labels = React.useMemo<DictionarySelectLabels>(
    () => ({
      placeholder: t('taxi_fleet.allocations.statusPlaceholder', 'Select status…'),
      addLabel: '',
      dialogTitle: '',
      valueLabel: '',
      valuePlaceholder: '',
      labelLabel: '',
      labelPlaceholder: '',
      emptyError: '',
      cancelLabel: t('common.cancel', 'Cancel'),
      saveLabel: t('common.save', 'Save'),
      errorLoad: t('taxi_fleet.allocations.statusLoadError', 'Could not load assignment statuses.'),
      errorSave: '',
      loadingLabel: t('taxi_fleet.trips.detail.loading', 'Loading…'),
      manageTitle: '',
    }),
    [t],
  )

  return (
    <DictionaryEntrySelect
      value={value || undefined}
      onChange={(next) => onChange(typeof next === 'string' ? next : '')}
      fetchOptions={fetchOptions}
      labels={labels}
      allowInlineCreate={false}
      allowAppearance={false}
      showManage={false}
      showLabelInput={false}
      disabled={disabled}
      selectClassName="w-full"
    />
  )
}
