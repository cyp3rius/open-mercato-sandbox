"use client"

import * as React from 'react'
import { apiFetch } from '@open-mercato/ui/backend/utils/api'
import { getDefaultEventTypeSuggestions, mergeEventTypeSuggestions } from '../components/utils/formHelpers'

export function useBusinessRuleFormEventSuggestions(): string[] {
  const [suggestions, setSuggestions] = React.useState<string[]>(getDefaultEventTypeSuggestions)

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await apiFetch('/api/events?excludeTriggerExcluded=false')
        if (!response.ok) return
        const body = (await response.json()) as { data?: Array<{ id?: string }> }
        const ids =
          Array.isArray(body?.data) ?
            body.data.map((entry) => entry.id).filter((id): id is string => typeof id === 'string' && id.length > 0)
          : []
        if (!cancelled && ids.length > 0) {
          setSuggestions(mergeEventTypeSuggestions(ids))
        }
      } catch {
        /* keep defaults */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return suggestions
}
