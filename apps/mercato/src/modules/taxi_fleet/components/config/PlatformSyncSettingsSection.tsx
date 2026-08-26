"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Label } from '@open-mercato/ui/primitives/label'
import { Switch } from '@open-mercato/ui/primitives/switch'
import { CRUD_FORM_TEXT_INPUT_CLASS } from '@open-mercato/ui/backend/CrudForm'
import type { TaxiFleetPlatformSyncPlatformSettings, TaxiFleetSettingsResponse } from '../../lib/taxiFleetSettings'
import type { TaxiFleetTripPlatform } from '../../lib/tripPlatforms'

const PLATFORMS: TaxiFleetTripPlatform[] = ['bolt', 'uber', 'free']

type PlatformSyncSettingsSectionProps = {
  settings: TaxiFleetSettingsResponse
  saving: boolean
  onChange: (next: TaxiFleetSettingsResponse) => void
}

function patchPlatform(
  settings: TaxiFleetSettingsResponse,
  platform: TaxiFleetTripPlatform,
  patch: Partial<TaxiFleetPlatformSyncPlatformSettings>,
): TaxiFleetSettingsResponse {
  return {
    ...settings,
    platformSync: {
      ...settings.platformSync,
      [platform]: { ...settings.platformSync[platform], ...patch },
    },
  }
}

function secretPlaceholder(configured: boolean): string {
  return configured ? '********' : ''
}

export function PlatformSyncSettingsSection({
  settings,
  saving,
  onChange,
}: PlatformSyncSettingsSectionProps) {
  const t = useT()

  return (
    <div className="space-y-6">
      {PLATFORMS.map((platform) => {
        const platformSettings = settings.platformSync[platform]
        const clientSecretConfigured =
          platform === 'bolt'
            ? settings.platformSyncBoltClientSecretConfigured
            : platform === 'uber'
              ? settings.platformSyncUberClientSecretConfigured
              : settings.platformSyncFreeClientSecretConfigured
        const refreshTokenConfigured =
          platform === 'bolt'
            ? settings.platformSyncBoltRefreshTokenConfigured
            : platform === 'uber'
              ? settings.platformSyncUberRefreshTokenConfigured
              : settings.platformSyncFreeRefreshTokenConfigured
        return (
          <div key={platform} className="rounded-md border border-border/70 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">
                  {t(`taxi_fleet.trips.platforms.${platform}`, platform)}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t('taxi_fleet.config.platformSync.platformHint', 'Enable live trip sync for this platform.')}
                </p>
              </div>
              <Switch
                checked={platformSettings.enabled}
                disabled={saving}
                onCheckedChange={(checked) =>
                  onChange(patchPlatform(settings, platform, { enabled: checked }))
                }
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1 md:col-span-2">
                <Label className="text-sm font-medium">
                  {t('taxi_fleet.config.platformSync.apiBaseUrl', 'API base URL')}
                </Label>
                <input
                  type="url"
                  className={CRUD_FORM_TEXT_INPUT_CLASS}
                  value={platformSettings.apiBaseUrl}
                  disabled={saving}
                  onChange={(event) =>
                    onChange(patchPlatform(settings, platform, { apiBaseUrl: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-medium">
                  {t('taxi_fleet.config.platformSync.clientId', 'Client ID')}
                </Label>
                <input
                  type="text"
                  className={CRUD_FORM_TEXT_INPUT_CLASS}
                  value={platformSettings.clientId}
                  disabled={saving}
                  onChange={(event) =>
                    onChange(patchPlatform(settings, platform, { clientId: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-medium">
                  {platform === 'free'
                    ? t('taxi_fleet.config.platformSync.apiKey', 'API key')
                    : t('taxi_fleet.config.platformSync.clientSecret', 'Client secret')}
                </Label>
                <input
                  type="password"
                  className={CRUD_FORM_TEXT_INPUT_CLASS}
                  value={platformSettings.clientSecret}
                  placeholder={secretPlaceholder(clientSecretConfigured)}
                  disabled={saving}
                  onChange={(event) =>
                    onChange(patchPlatform(settings, platform, { clientSecret: event.target.value }))
                  }
                />
              </div>
              {platform !== 'free' ? (
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-sm font-medium">
                    {t('taxi_fleet.config.platformSync.refreshToken', 'Refresh token (optional)')}
                  </Label>
                  <input
                    type="password"
                    className={CRUD_FORM_TEXT_INPUT_CLASS}
                    value={platformSettings.refreshToken}
                    placeholder={secretPlaceholder(refreshTokenConfigured)}
                    disabled={saving}
                    onChange={(event) =>
                      onChange(patchPlatform(settings, platform, { refreshToken: event.target.value }))
                    }
                  />
                </div>
              ) : null}
              <div className="space-y-1 md:col-span-2">
                <Label className="text-sm font-medium">
                  {t('taxi_fleet.config.platformSync.companyId', 'Company / fleet ID')}
                </Label>
                <input
                  type="text"
                  className={CRUD_FORM_TEXT_INPUT_CLASS}
                  value={platformSettings.companyId}
                  disabled={saving}
                  onChange={(event) =>
                    onChange(patchPlatform(settings, platform, { companyId: event.target.value }))
                  }
                />
              </div>
            </div>
          </div>
        )
      })}
      <p className="text-xs text-muted-foreground">
        {t(
          'taxi_fleet.config.platformSync.docsHint',
          'Obtain API credentials from each platform fleet console. Driver platform IDs are configured on driver profiles.',
        )}
      </p>
    </div>
  )
}
