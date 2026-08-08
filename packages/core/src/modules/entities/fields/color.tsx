"use client"

import * as React from 'react'
import type { CrudCustomFieldRenderProps } from '@open-mercato/ui/backend/CrudForm'
import { FieldRegistry } from '@open-mercato/ui/backend/fields/registry'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { renderDictionaryColor } from '../../dictionaries/components/dictionaryAppearance'

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

function normalizeColorValue(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (HEX_COLOR_PATTERN.test(trimmed)) return trimmed
  if (/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) return `#${trimmed}`
  return trimmed
}

function ColorFieldInput({ value, setValue, disabled }: CrudCustomFieldRenderProps) {
  const t = useT()
  const normalized = normalizeColorValue(value)
  const pickerValue = HEX_COLOR_PATTERN.test(normalized) ? normalized : '#000000'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="color"
        value={pickerValue}
        disabled={disabled}
        className="h-9 w-12 cursor-pointer rounded border border-input bg-background p-1 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={t('entities.customFields.color.pickerLabel', 'Color picker')}
        onChange={(event) => setValue(event.target.value)}
      />
      <input
        type="text"
        value={normalized}
        disabled={disabled}
        placeholder={t('entities.customFields.color.placeholder', '#64748b')}
        className="min-w-[8rem] flex-1 rounded border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
        onChange={(event) => {
          const next = event.target.value.trim()
          setValue(next.length ? next : undefined)
        }}
      />
      {normalized ? renderDictionaryColor(normalized, 'h-8 w-8 rounded') : null}
      {normalized ? (
        <button
          type="button"
          disabled={disabled}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => setValue(undefined)}
        >
          {t('entities.customFields.color.clear', 'Clear')}
        </button>
      ) : null}
    </div>
  )
}

FieldRegistry.register('color', {
  input: ColorFieldInput,
})
