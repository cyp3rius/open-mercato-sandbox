'use client'

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Label } from '@open-mercato/ui/primitives/label'
import { Switch } from '@open-mercato/ui/primitives/switch'
import { Button } from '@open-mercato/ui/primitives/button'
import { CRUD_FORM_TEXT_INPUT_CLASS } from '@open-mercato/ui/backend/CrudForm'
import { readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import type { TaxiFleetPlatformSyncPlatformSettings, TaxiFleetSettingsResponse } from '../../lib/taxiFleetSettings'
import type { TaxiFleetTripPlatform } from '../../lib/tripPlatforms'
import { BOLT_DEFAULT_API_BASE_URL } from '../../lib/platformSync/adapters/bolt/constants'

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
  const [testingBolt, setTestingBolt] = React.useState(false)

  const testBoltConnection = async () => {
    setTestingBolt(true)
    try {
      const result = await readApiResultOrThrow<{
        ok: boolean
        apiBaseUrl: string
        companyCount: number
        companyIdMatched: boolean | null
      }>('/api/taxi_fleet/platform-sync/test-connection', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ platform: 'bolt' }),
      })
      if (result.companyIdMatched === false) {
        flash(
          t(
            'taxi_fleet.config.platformSync.test.companyMismatch',
            'Connected, but company ID was not found in Bolt companies list.',
          ),
          'warning',
        )
      } else {
        flash(
          t('taxi_fleet.config.platformSync.test.success', 'Bolt connection OK ({count} companies).', {
            count: result.companyCount,
          }),
          'success',
        )
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t('taxi_fleet.config.platformSync.test.error', 'Bolt connection test failed.')
      flash(message, 'error')
    } finally {
      setTestingBolt(false)
    }
  }

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
          platform === 'uber'
            ? settings.platformSyncUberRefreshTokenConfigured
            : settings.platformSyncFreeRefreshTokenConfigured
        const isBolt = platform === 'bolt'
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
                  placeholder={isBolt ? BOLT_DEFAULT_API_BASE_URL : undefined}
                  disabled={saving}
                  onChange={(event) =>
                    onChange(patchPlatform(settings, platform, { apiBaseUrl: event.target.value }))
                  }
                />
                {isBolt ? (
                  <p className="text-xs text-muted-foreground">
                    {t(
                      'taxi_fleet.config.platformSync.boltApiBaseHint',
                      'Leave empty to use the default Bolt Fleet Integration Gateway.',
                    )}
                  </p>
                ) : null}
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
              {platform === 'uber' ? (
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
                  {isBolt
                    ? t('taxi_fleet.config.platformSync.companyIdRequired', 'Company ID (required)')
                    : t('taxi_fleet.config.platformSync.companyId', 'Company / fleet ID')}
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
              {isBolt ? (
                <div className="md:col-span-2 space-y-1">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving || testingBolt}
                    onClick={() => void testBoltConnection()}
                  >
                    {testingBolt
                      ? t('taxi_fleet.config.platformSync.test.running', 'Testing…')
                      : t('taxi_fleet.config.platformSync.test.action', 'Test connection')}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      'taxi_fleet.config.platformSync.test.hint',
                      'Uses saved credentials (save settings first). Requires Client ID, secret, and company ID.',
                    )}
                  </p>
                </div>
              ) : null}
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
