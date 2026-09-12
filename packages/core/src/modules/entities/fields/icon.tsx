"use client"

import * as React from 'react'
import type { CrudCustomFieldRenderProps } from '@open-mercato/ui/backend/CrudForm'
import { FieldRegistry } from '@open-mercato/ui/backend/fields/registry'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { AppearanceSelector } from '../../dictionaries/components/AppearanceSelector'

function normalizeIconValue(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed.length ? trimmed : null
}

function IconFieldInput({ value, setValue, disabled }: CrudCustomFieldRenderProps) {
  const t = useT()
  const icon = normalizeIconValue(value)
  const labels = React.useMemo(
    () => ({
      colorLabel: t('dictionaries.config.entries.dialog.colorLabel', 'Color'),
      colorClearLabel: t('dictionaries.config.entries.dialog.colorClear', 'Remove color'),
      iconLabel: t('dictionaries.config.entries.dialog.iconLabel', 'Icon'),
      iconPlaceholder: t('dictionaries.config.entries.dialog.iconPlaceholder', 'Select icon'),
      iconPickerTriggerLabel: t('dictionaries.config.entries.dialog.iconBrowse', 'Browse icons and emoji'),
      iconSearchPlaceholder: t('dictionaries.config.entries.dialog.iconSearch', 'Search icons…'),
      iconSearchEmptyLabel: t('dictionaries.config.entries.dialog.iconSearchEmpty', 'No icons match your search.'),
      iconSuggestionsLabel: t('dictionaries.config.entries.dialog.iconSuggestions', 'Suggestions'),
      iconClearLabel: t('dictionaries.config.entries.dialog.iconClear', 'Remove icon'),
      previewEmptyLabel: t('dictionaries.config.entries.dialog.previewEmpty', 'No appearance selected'),
    }),
    [t],
  )

  return (
    <AppearanceSelector
      icon={icon}
      color={null}
      iconOnly
      disabled={disabled}
      labels={labels}
      onIconChange={(next) => setValue(next ?? undefined)}
      onColorChange={() => {}}
    />
  )
}

FieldRegistry.register('icon', {
  input: IconFieldInput,
})
