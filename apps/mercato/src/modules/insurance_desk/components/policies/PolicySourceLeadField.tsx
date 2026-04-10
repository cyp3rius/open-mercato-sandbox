"use client"

import * as React from 'react'
import type { CrudCustomFieldRenderProps } from '@open-mercato/ui/backend/CrudForm'
import { EntitySearchCombobox } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePolicyCreateLeadMerge } from './PolicyCreateLeadMergeContext'
import { INSURANCE_DESK_BASE } from '../../backend/insurance-desk/paths'

type LeadRow = { id: string; title: string }

/**
 * Searchable selection of an insurance lead that has no linked policy (API: `unlinkedOnly`).
 */
export function PolicySourceLeadField(props: CrudCustomFieldRenderProps) {
  const t = useT()
  const leadMerge = usePolicyCreateLeadMerge()
  const { value, setValue, disabled } = props
  const id = typeof value === 'string' ? value.trim() : ''
  const [resolvedTitle, setResolvedTitle] = React.useState<string | null>(null)
  const [mergeBusy, setMergeBusy] = React.useState(false)

  React.useEffect(() => {
    if (!id) {
      setResolvedTitle(null)
      return
    }
    let cancelled = false
    async function load() {
      const call = await apiCall<{ items?: LeadRow[] }>(
        `/api/insurance/leads?id=${encodeURIComponent(id)}&page=1&pageSize=1`,
      )
      const row = call.result?.items?.[0]
      if (cancelled || !row) return
      setResolvedTitle(row.title?.trim().length ? row.title : row.id)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  const loadSuggestions = React.useCallback(async (query?: string) => {
    const params = new URLSearchParams()
    params.set('page', '1')
    params.set('pageSize', '50')
    params.set('unlinkedOnly', 'true')
    const q = typeof query === 'string' ? query.trim() : ''
    if (q.length) params.set('search', q)
    const call = await apiCall<{ items?: LeadRow[] }>(`/api/insurance/leads?${params.toString()}`)
    const items = Array.isArray(call.result?.items) ? call.result.items : []
    return items.map((row) => ({
      value: row.id,
      label: row.title?.trim().length ? row.title : row.id,
    }))
  }, [])

  const handleChange = React.useCallback(
    (nextRaw: string) => {
      const next = typeof nextRaw === 'string' ? nextRaw.trim() : ''
      if (next === id) return
      if (!next) {
        setValue('')
        return
      }
      if (leadMerge) {
        setMergeBusy(true)
        void leadMerge
          .mergeLeadFromPicker(next, id)
          .finally(() => {
            setMergeBusy(false)
          })
        return
      }
      setValue(next)
    },
    [id, leadMerge, setValue],
  )

  return (
    <EntitySearchCombobox
      value={id}
      onChange={handleChange}
      options={[]}
      placeholder={t('insurance_desk.policies.form.sourceLead.placeholder', 'Search inquiry…')}
      onRemoteSearch={loadSuggestions}
      selectedDisplayOverride={resolvedTitle ?? undefined}
      createInNewTabHref={`${INSURANCE_DESK_BASE}/leads/create`}
      disabled={disabled || mergeBusy}
    />
  )
}
