"use client"

import * as React from 'react'
import type { CrudCustomFieldRenderProps } from '@open-mercato/ui/backend/CrudForm'
import { FieldRegistry } from '@open-mercato/ui/backend/fields/registry'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { DictionarySelectControl } from '../components/DictionarySelectControl'
import { DictionaryMultiSelectControl } from '../components/DictionaryMultiSelectControl'

type DictionaryFieldDefinition = {
  dictionaryId?: string
  dictionaryInlineCreate?: boolean
  multi?: boolean
}

type Props = CrudCustomFieldRenderProps & { def?: DictionaryFieldDefinition }

type DictionarySummary = {
  id: string
  name: string
  key: string
  isActive: boolean
}

function DictionaryFieldDefEditor({ def, onChange }: { def: { configJson?: DictionaryFieldDefinition } | undefined; onChange: (patch: Partial<DictionaryFieldDefinition>) => void }) {
  const t = useT()
  const [items, setItems] = React.useState<DictionarySummary[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const selectedId = typeof def?.configJson?.dictionaryId === 'string' ? def?.configJson?.dictionaryId : ''
  const inlineCreate = def?.configJson?.dictionaryInlineCreate !== false
  const allowMultiple = Boolean(def?.configJson?.multi)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const call = await apiCall<{ items?: unknown[]; error?: string }>(
          '/api/dictionaries?includeInactive=true',
        )
        if (!call.ok) {
          const message =
            typeof call.result?.error === 'string' ? call.result.error : 'Failed to load dictionaries'
          throw new Error(message)
        }
        const entries = Array.isArray(call.result?.items) ? call.result!.items : []
        if (!cancelled) {
          setItems(
            entries.map((entry: any) => ({
              id: String(entry.id),
              name: typeof entry.name === 'string' && entry.name.trim().length ? entry.name : String(entry.key ?? entry.id),
              key: typeof entry.key === 'string' ? entry.key : '',
              isActive: entry.isActive !== false,
            })),
          )
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load dictionaries list', err)
          setError(t('dictionaries.customFields.errorLoad', 'Failed to load dictionaries.'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    load().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [t])

  const manageHref = '/backend/config/dictionaries'

  return (
    <div className="mt-3 space-y-3 rounded border border-dashed border-muted-foreground/40 bg-muted/10 p-3">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          {t('dictionaries.customFields.dictionaryLabel', 'Dictionary source')}
        </label>
        <select
          className="w-full rounded border px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          value={selectedId}
          onChange={(event) => onChange({ dictionaryId: event.target.value || undefined })}
        >
          <option value="">{t('dictionaries.customFields.dictionaryPlaceholder', 'Select a dictionary')}</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
              {item.isActive ? '' : ` (${t('dictionaries.customFields.inactive', 'inactive')})`}
            </option>
          ))}
        </select>
        {loading ? (
          <p className="text-xs text-muted-foreground">
            {t('dictionaries.customFields.loading', 'Loading dictionaries…')}
          </p>
        ) : null}
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        {!loading && !error && items.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t('dictionaries.customFields.empty', 'No dictionaries available yet. Create one first.')}
          </p>
        ) : null}
      </div>
      {selectedId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded bg-background/60 px-2 py-1 text-xs text-muted-foreground">
          <span>{t('dictionaries.customFields.selectedHint', 'Entries from this dictionary populate the field.')}</span>
          <a href={manageHref} className="font-medium text-primary hover:underline" target="_blank" rel="noreferrer">
            {t('dictionaries.customFields.manageLink', 'Manage dictionaries')}
          </a>
        </div>
      ) : null}
      <label className="inline-flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={inlineCreate}
          onChange={(event) => onChange({ dictionaryInlineCreate: event.target.checked })}
          disabled={!selectedId}
        />
        {t('dictionaries.customFields.allowInlineCreate', 'Allow inline creation inside forms')}
      </label>
      <label className="inline-flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={allowMultiple}
          onChange={(event) => onChange({ multi: event.target.checked })}
          disabled={!selectedId}
        />
        {t('dictionaries.customFields.allowMultipleSelections', 'Allow multiple selections')}
      </label>
    </div>
  )
}

function normalizeDictionarySingleValue(raw: unknown): string | undefined {
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'string') return raw[0]
  return undefined
}

function normalizeDictionaryMultiValue(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
  if (typeof raw === 'string' && raw.trim().length > 0) return [raw.trim()]
  return []
}

function DictionaryFieldInput({ value, setValue, disabled, def }: Props) {
  const t = useT()
  const dictionaryId = def?.dictionaryId
  if (!dictionaryId) {
    return (
      <div className="rounded border border-dashed p-3 text-sm text-muted-foreground">
        {t('dictionaries.config.entries.error.load', 'Failed to load dictionary entries.')}
      </div>
    )
  }
  const isMulti = Boolean(def?.multi)
  if (isMulti) {
    return (
      <DictionaryMultiSelectControl
        dictionaryId={dictionaryId}
        value={normalizeDictionaryMultiValue(value)}
        onChange={(next) => setValue(next.length ? next : undefined)}
        allowInlineCreate={def?.dictionaryInlineCreate !== false}
        disabled={disabled}
      />
    )
  }
  const normalizedValue = normalizeDictionarySingleValue(value)
  return (
    <DictionarySelectControl
      dictionaryId={dictionaryId}
      value={normalizedValue ?? ''}
      onChange={(next) => setValue(next ?? undefined)}
      allowInlineCreate={def?.dictionaryInlineCreate !== false}
      disabled={disabled}
    />
  )
}

FieldRegistry.register('dictionary', {
  input: DictionaryFieldInput,
  defEditor: (props) => <DictionaryFieldDefEditor {...props} />,
})
