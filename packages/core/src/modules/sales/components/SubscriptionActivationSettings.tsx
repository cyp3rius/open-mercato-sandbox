"use client"

import * as React from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@open-mercato/ui/primitives/button'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type OrderStatusOption = {
  id: string
  value: string
  label: string
}

type SettingsResponse = {
  subscriptionActivationOrderStatuses: string[]
  orderStatuses: OrderStatusOption[]
}

const normalizeStatusList = (list: unknown): string[] => {
  if (!Array.isArray(list)) return []
  const set = new Set<string>()
  list.forEach((value) => {
    if (typeof value === 'string' && value.trim().length) {
      set.add(value.trim().toLowerCase())
    }
  })
  return Array.from(set)
}

export function SubscriptionActivationSettings() {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [options, setOptions] = React.useState<OrderStatusOption[]>([])
  const [statuses, setStatuses] = React.useState<string[]>(['confirmed'])

  const translations = React.useMemo(
    () => ({
      title: t('sales.config.subscriptionActivation.title', 'Subscription activation'),
      description: t(
        'sales.config.subscriptionActivation.description',
        'Choose which order statuses create and activate customer subscription offerings.',
      ),
      statusesLabel: t(
        'sales.config.subscriptionActivation.statusesLabel',
        'Activate offerings when order status is',
      ),
      pickStatuses: t(
        'sales.config.subscriptionActivation.pickStatuses',
        'Select one or more order statuses. Empty selection falls back to confirmed.',
      ),
      note: t(
        'sales.config.subscriptionActivation.note',
        'Subscription product lines still require start and end dates before activation.',
      ),
      actions: {
        refresh: t('sales.config.subscriptionActivation.actions.refresh', 'Refresh'),
        refreshing: t('sales.config.subscriptionActivation.actions.refreshing', 'Refreshing…'),
        save: t('sales.config.subscriptionActivation.actions.save', 'Save settings'),
      },
      messages: {
        loadError: t(
          'sales.config.subscriptionActivation.errors.load',
          'Failed to load subscription activation settings.',
        ),
        saveError: t(
          'sales.config.subscriptionActivation.errors.save',
          'Failed to save subscription activation settings.',
        ),
        saved: t(
          'sales.config.subscriptionActivation.success.save',
          'Subscription activation settings saved.',
        ),
      },
    }),
    [t],
  )

  const loadSettings = React.useCallback(async () => {
    setLoading(true)
    try {
      const call = await apiCall<SettingsResponse>('/api/sales/settings/subscription-activation')
      if (!call.ok) {
        flash(translations.messages.loadError, 'error')
        return
      }
      setOptions(Array.isArray(call.result?.orderStatuses) ? call.result.orderStatuses : [])
      setStatuses(normalizeStatusList(call.result?.subscriptionActivationOrderStatuses))
    } catch (err) {
      console.error('sales.subscription-activation-settings.load failed', err)
      flash(translations.messages.loadError, 'error')
    } finally {
      setLoading(false)
    }
  }, [translations.messages.loadError])

  React.useEffect(() => {
    void loadSettings()
  }, [loadSettings, scopeVersion])

  const toggleStatus = React.useCallback((value: string) => {
    const normalized = value.trim().toLowerCase()
    setStatuses((prev) => {
      if (prev.includes(normalized)) {
        return prev.filter((entry) => entry !== normalized)
      }
      return [...prev, normalized]
    })
  }, [])

  const handleSubmit = React.useCallback(async () => {
    setSaving(true)
    try {
      const call = await apiCall<SettingsResponse>('/api/sales/settings/subscription-activation', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subscriptionActivationOrderStatuses: statuses,
        }),
      })
      if (!call.ok) {
        flash(translations.messages.saveError, 'error')
        return
      }
      setStatuses(normalizeStatusList(call.result?.subscriptionActivationOrderStatuses))
      setOptions(Array.isArray(call.result?.orderStatuses) ? call.result.orderStatuses : [])
      flash(translations.messages.saved, 'success')
    } catch (err) {
      console.error('sales.subscription-activation-settings.save failed', err)
      flash(translations.messages.saveError, 'error')
    } finally {
      setSaving(false)
    }
  }, [statuses, translations.messages.saveError, translations.messages.saved])

  return (
    <section className="space-y-4 rounded-none border bg-card/30 p-5 shadow-sm !rounded-none">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{translations.title}</h2>
          <p className="text-sm text-muted-foreground">{translations.description}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            className="rounded-none border-0 shadow-none hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            onClick={() => void loadSettings()}
            disabled={loading || saving}
            aria-label={translations.actions.refresh}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="sr-only">
              {loading ? translations.actions.refreshing : translations.actions.refresh}
            </span>
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{translations.note}</p>
      <div className="space-y-3 rounded-none border bg-card/30 p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">{translations.statusesLabel}</p>
          <p className="text-xs text-muted-foreground">{translations.pickStatuses}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {options.map((status) => {
            const value = status.value.trim().toLowerCase()
            const checked = statuses.includes(value)
            return (
              <label
                key={status.id}
                className="flex items-center gap-2 rounded-none border bg-background p-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border"
                  checked={checked}
                  onChange={() => toggleStatus(status.value)}
                  disabled={loading || saving}
                />
                <span className="truncate" title={status.label || status.value}>
                  {status.label || status.value}
                </span>
                <Badge variant="outline" className="ml-auto text-[11px] uppercase tracking-wide">
                  {status.value}
                </Badge>
              </label>
            )
          })}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-none border-0 shadow-none hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
          onClick={() => void loadSettings()}
          disabled={loading || saving}
          aria-label={translations.actions.refresh}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="sr-only">
            {loading ? translations.actions.refreshing : translations.actions.refresh}
          </span>
        </Button>
        <Button type="button" onClick={() => void handleSubmit()} disabled={loading || saving}>
          {translations.actions.save}
        </Button>
      </div>
    </section>
  )
}
