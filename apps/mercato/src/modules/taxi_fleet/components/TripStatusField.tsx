"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import {
  DictionaryEntrySelect,
  type DictionaryOption,
  type DictionarySelectLabels,
} from '@open-mercato/core/modules/dictionaries/components/DictionaryEntrySelect'
import { useTripStatusDictionary } from './useTripStatusDictionary'

type TripStatusFieldProps = {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
}

export function TripStatusField({ value, onChange, disabled = false }: TripStatusFieldProps) {
  const t = useT()
  const { statuses } = useTripStatusDictionary()

  const fetchOptions = React.useCallback(async (): Promise<DictionaryOption[]> => {
    return statuses.map((entry) => ({
      value: entry.code,
      label: entry.label.trim() || entry.code,
      color: entry.color?.trim() ? entry.color.trim() : null,
      icon: entry.icon?.trim() ? entry.icon.trim() : null,
    }))
  }, [statuses])

  const labels = React.useMemo<DictionarySelectLabels>(
    () => ({
      placeholder: t('taxi_fleet.trips.form.statusPlaceholder', 'Select status…'),
      addLabel: '',
      dialogTitle: '',
      valueLabel: '',
      valuePlaceholder: '',
      labelLabel: '',
      labelPlaceholder: '',
      emptyError: '',
      cancelLabel: t('common.cancel', 'Cancel'),
      saveLabel: t('common.save', 'Save'),
      errorLoad: t('taxi_fleet.trips.form.statusLoadError', 'Could not load trip statuses.'),
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
