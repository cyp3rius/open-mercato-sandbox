'use client'

import * as React from 'react'
import { Save } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall, readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { LoadingMessage, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { Button } from '@open-mercato/ui/primitives/button'
import { flash } from '@open-mercato/ui/backend/FlashMessages'

type PreferenceTypeState = {
  type: string
  labelKey: string
  enabled: boolean
  locked: boolean
}

type PreferenceModuleGroup = {
  moduleId: string
  moduleTitle: string
  types: PreferenceTypeState[]
}

type PreferencesResponse = {
  groups: PreferenceModuleGroup[]
}

function isModuleFullyEnabled(group: PreferenceModuleGroup, preferences: Record<string, boolean>): boolean {
  const editableTypes = group.types.filter((entry) => !entry.locked)
  if (editableTypes.length === 0) {
    return group.types.every((entry) => entry.locked && preferences[entry.type] !== false)
  }
  return editableTypes.every((entry) => preferences[entry.type] !== false)
}

function isModulePartiallyEnabled(group: PreferenceModuleGroup, preferences: Record<string, boolean>): boolean {
  const enabledCount = group.types.filter((entry) => preferences[entry.type] !== false).length
  return enabledCount > 0 && enabledCount < group.types.length
}

export function NotificationPreferencesEditor() {
  const t = useT()
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [groups, setGroups] = React.useState<PreferenceModuleGroup[]>([])
  const [preferences, setPreferences] = React.useState<Record<string, boolean>>({})

  const loadPreferences = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { ok, result } = await apiCall<PreferencesResponse>('/api/notifications/preferences')
      if (!ok || !result) throw new Error('load_failed')

      const nextPreferences: Record<string, boolean> = {}
      for (const group of result.groups) {
        for (const entry of group.types) {
          nextPreferences[entry.type] = entry.enabled
        }
      }

      setGroups(result.groups)
      setPreferences(nextPreferences)
    } catch (loadError) {
      console.error('Failed to load notification preferences', loadError)
      setError(t('notifications.preferences.errors.load', 'Failed to load notification preferences.'))
    } finally {
      setLoading(false)
    }
  }, [t])

  React.useEffect(() => {
    void loadPreferences()
  }, [loadPreferences])

  const setTypeEnabled = React.useCallback((type: string, enabled: boolean) => {
    setPreferences((current) => ({ ...current, [type]: enabled }))
  }, [])

  const setModuleEnabled = React.useCallback((group: PreferenceModuleGroup, enabled: boolean) => {
    setPreferences((current) => {
      const next = { ...current }
      for (const entry of group.types) {
        if (entry.locked) continue
        next[entry.type] = enabled
      }
      return next
    })
  }, [])

  const handleSave = React.useCallback(async () => {
    setSaving(true)
    try {
      await readApiResultOrThrow(
        '/api/notifications/preferences',
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ preferences }),
        },
        { errorMessage: t('notifications.preferences.errors.save', 'Failed to save notification preferences.') },
      )
      flash(t('notifications.preferences.success', 'Notification preferences saved.'), 'success')
      await loadPreferences()
    } catch (saveError) {
      console.error('Failed to save notification preferences', saveError)
    } finally {
      setSaving(false)
    }
  }, [loadPreferences, preferences, t])

  if (loading) {
    return <LoadingMessage label={t('notifications.preferences.loading', 'Loading notification preferences...')} />
  }

  if (error) {
    return <ErrorMessage label={error} />
  }

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('notifications.preferences.empty', 'No configurable notifications are available for your permissions.')}
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {groups.map((group) => {
          const moduleEnabled = isModuleFullyEnabled(group, preferences)
          const modulePartial = isModulePartiallyEnabled(group, preferences)
          const editableTypes = group.types.filter((entry) => !entry.locked)
          const moduleCheckboxDisabled = editableTypes.length === 0

          return (
            <div key={group.moduleId} className="rounded border p-3">
              <div className="mb-3 flex items-center justify-between border-b pb-2">
                <div className="text-sm font-medium">{group.moduleTitle}</div>
                <div className="flex items-center gap-2">
                  <input
                    id={`notification-module-${group.moduleId}`}
                    type="checkbox"
                    className="h-4 w-4"
                    checked={moduleEnabled}
                    disabled={moduleCheckboxDisabled}
                    ref={(element) => {
                      if (element) element.indeterminate = modulePartial && !moduleEnabled
                    }}
                    onChange={(event) => setModuleEnabled(group, event.target.checked)}
                  />
                  <label
                    htmlFor={`notification-module-${group.moduleId}`}
                    className="text-sm text-muted-foreground"
                  >
                    {t('notifications.preferences.moduleAll', 'All')}
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                {group.types.map((entry) => {
                  const checked = preferences[entry.type] !== false
                  return (
                    <div key={entry.type} className="flex items-start gap-2">
                      <input
                        id={`notification-type-${entry.type}`}
                        type="checkbox"
                        className="mt-0.5 h-4 w-4"
                        checked={checked}
                        disabled={entry.locked}
                        onChange={(event) => setTypeEnabled(entry.type, event.target.checked)}
                      />
                      <label
                        htmlFor={`notification-type-${entry.type}`}
                        className={`text-sm ${entry.locked ? 'text-muted-foreground' : ''}`}
                      >
                        {t(entry.labelKey, entry.type)}
                        {entry.locked ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {t('notifications.preferences.lockedByRole', 'Required by role')}
                          </span>
                        ) : null}
                      </label>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={() => void handleSave()} disabled={saving}>
          <Save className="mr-2 size-4" />
          {saving
            ? t('notifications.preferences.saving', 'Saving...')
            : t('notifications.preferences.save', 'Save preferences')}
        </Button>
      </div>
    </div>
  )
}
