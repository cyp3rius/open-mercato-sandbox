'use client'

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Label } from '@open-mercato/ui/primitives/label'
import { Switch } from '@open-mercato/ui/primitives/switch'
import { CRUD_FORM_TEXT_INPUT_CLASS } from '@open-mercato/ui/backend/CrudForm'
import type { TaxiFleetSettingsResponse } from '../../lib/taxiFleetSettings'

type Props = {
  settings: TaxiFleetSettingsResponse
  saving: boolean
  onChange: (next: TaxiFleetSettingsResponse) => void
}

function secretPlaceholder(configured: boolean): string {
  return configured ? '********' : ''
}

export function BpOpenFleetSettingsSection({ settings, saving, onChange }: Props) {
  const t = useT()
  const bp = settings.bpOpenFleet

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{t('taxi_fleet.config.bpOpenFleet.enabled', 'Enable BP Open Fleet')}</div>
          <p className="text-xs text-muted-foreground">
            {t(
              'taxi_fleet.config.bpOpenFleet.enabledHint',
              'Manual fuel-cost sync on vehicle monthly settlements.',
            )}
          </p>
        </div>
        <Switch
          checked={bp.enabled}
          disabled={saving}
          onCheckedChange={(checked) =>
            onChange({
              ...settings,
              bpOpenFleet: { ...bp, enabled: checked },
            })
          }
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-sm font-medium">{t('taxi_fleet.config.bpOpenFleet.apiBaseUrl', 'API base URL')}</Label>
          <input
            className={CRUD_FORM_TEXT_INPUT_CLASS}
            value={bp.apiBaseUrl}
            disabled={saving}
            onChange={(event) =>
              onChange({ ...settings, bpOpenFleet: { ...bp, apiBaseUrl: event.target.value } })
            }
          />
        </div>
        <div className="space-y-1">
          <Label className="text-sm font-medium">{t('taxi_fleet.config.bpOpenFleet.apiPrefix', 'API prefix')}</Label>
          <input
            className={CRUD_FORM_TEXT_INPUT_CLASS}
            value={bp.apiPrefix}
            disabled={saving}
            placeholder="e.g. pl or openapi"
            onChange={(event) =>
              onChange({ ...settings, bpOpenFleet: { ...bp, apiPrefix: event.target.value } })
            }
          />
        </div>
        <div className="space-y-1">
          <Label className="text-sm font-medium">{t('taxi_fleet.config.bpOpenFleet.clientId', 'Client ID')}</Label>
          <input
            className={CRUD_FORM_TEXT_INPUT_CLASS}
            value={bp.clientId}
            disabled={saving}
            onChange={(event) =>
              onChange({ ...settings, bpOpenFleet: { ...bp, clientId: event.target.value } })
            }
          />
        </div>
        <div className="space-y-1">
          <Label className="text-sm font-medium">
            {t('taxi_fleet.config.bpOpenFleet.clientSecret', 'Client secret')}
          </Label>
          <input
            type="password"
            className={CRUD_FORM_TEXT_INPUT_CLASS}
            value={bp.clientSecret || secretPlaceholder(settings.bpOpenFleetClientSecretConfigured)}
            disabled={saving}
            onChange={(event) =>
              onChange({ ...settings, bpOpenFleet: { ...bp, clientSecret: event.target.value } })
            }
          />
        </div>
        <div className="space-y-1">
          <Label className="text-sm font-medium">
            {t('taxi_fleet.config.bpOpenFleet.authorityId', 'Authority ID')}
          </Label>
          <input
            className={CRUD_FORM_TEXT_INPUT_CLASS}
            value={bp.authorityId}
            disabled={saving}
            onChange={(event) =>
              onChange({ ...settings, bpOpenFleet: { ...bp, authorityId: event.target.value } })
            }
          />
        </div>
        <div className="space-y-1">
          <Label className="text-sm font-medium">{t('taxi_fleet.config.bpOpenFleet.parentId', 'Parent ID')}</Label>
          <input
            className={CRUD_FORM_TEXT_INPUT_CLASS}
            value={bp.parentId}
            disabled={saving}
            onChange={(event) =>
              onChange({ ...settings, bpOpenFleet: { ...bp, parentId: event.target.value } })
            }
          />
        </div>
      </div>
    </div>
  )
}
