"use client"

import * as React from 'react'
import Link from 'next/link'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { Label } from '@open-mercato/ui/primitives/label'
import { Switch } from '@open-mercato/ui/primitives/switch'
import { CRUD_FORM_SELECT_CLASS, CRUD_FORM_TEXT_INPUT_CLASS } from '@open-mercato/ui/backend/CrudForm'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCallOrThrow, readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { Spinner } from '@open-mercato/ui/primitives/spinner'
import {
  TAXI_FLEET_CUSTOMER_EMAIL_EVENTS,
  defaultTaxiFleetSettings,
  normalizeTaxiFleetSettingsResponse,
  type LocalizedCustomerEmailTemplate,
  type TaxiFleetSettingsResponse,
} from '../../lib/taxiFleetSettings'
import { ResourceTypeSearchField } from '../ResourceTypeSearchField'
import { PercentInputField } from '@open-mercato/ui/backend/inputs/PercentInputField'
import { TripStatusSettingsSection } from './TripStatusSettingsSection'
import {
  normalizeTripStatusDefinition,
  tripStatusDictionarySchema,
} from '../../lib/tripStatuses'

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border bg-card p-4 space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function BilingualTemplateFields({
  value,
  onChange,
  disabled,
  labels,
}: {
  value: LocalizedCustomerEmailTemplate
  onChange: (next: LocalizedCustomerEmailTemplate) => void
  disabled?: boolean
  labels: {
    subjectPl: string
    subjectEn: string
    preheaderPl: string
    preheaderEn: string
    headingPl: string
    headingEn: string
    introPl: string
    introEn: string
    footerPl: string
    footerEn: string
  }
}) {
  const patch = (patchValue: Partial<LocalizedCustomerEmailTemplate>) => onChange({ ...value, ...patchValue })
  const field = (key: keyof LocalizedCustomerEmailTemplate, label: string, multiline = false) => (
    <div className="space-y-1">
      <Label className="text-sm font-medium">{label}</Label>
      {multiline ? (
        <textarea
          value={String(value[key] ?? '')}
          disabled={disabled}
          rows={3}
          className={`${CRUD_FORM_TEXT_INPUT_CLASS} min-h-[4.5rem] resize-y`}
          onChange={(event) => patch({ [key]: event.target.value } as Partial<LocalizedCustomerEmailTemplate>)}
        />
      ) : (
        <input
          type="text"
          value={String(value[key] ?? '')}
          disabled={disabled}
          className={CRUD_FORM_TEXT_INPUT_CLASS}
          onChange={(event) => patch({ [key]: event.target.value } as Partial<LocalizedCustomerEmailTemplate>)}
        />
      )}
    </div>
  )

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {field('subjectPl', labels.subjectPl)}
      {field('subjectEn', labels.subjectEn)}
      {field('preheaderPl', labels.preheaderPl)}
      {field('preheaderEn', labels.preheaderEn)}
      {field('headingPl', labels.headingPl)}
      {field('headingEn', labels.headingEn)}
      {field('introPl', labels.introPl, true)}
      {field('introEn', labels.introEn, true)}
      {field('footerNotePl', labels.footerPl, true)}
      {field('footerNoteEn', labels.footerEn, true)}
    </div>
  )
}

export function TaxiFleetModuleSettings() {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const [settings, setSettings] = React.useState<TaxiFleetSettingsResponse>(() =>
    normalizeTaxiFleetSettingsResponse(defaultTaxiFleetSettings()),
  )
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const data = await readApiResultOrThrow<TaxiFleetSettingsResponse>('/api/taxi_fleet/settings', undefined, {
        errorMessage: t('taxi_fleet.config.error.load', 'Failed to load taxi fleet settings.'),
      })
      setSettings(normalizeTaxiFleetSettingsResponse(data))
    } catch (err) {
      console.error('taxi fleet settings load', err)
      flash(t('taxi_fleet.config.error.load', 'Failed to load taxi fleet settings.'), 'error')
      setSettings(normalizeTaxiFleetSettingsResponse(defaultTaxiFleetSettings()))
    } finally {
      setLoading(false)
    }
  }, [scopeVersion, t])

  React.useEffect(() => {
    void load()
  }, [load])

  const save = React.useCallback(async () => {
    const normalizedStatuses = settings.tripStatuses
      .map((entry) => normalizeTripStatusDefinition(entry))
      .filter((entry) => entry.code.length > 0)
    const parsedStatuses = tripStatusDictionarySchema.safeParse(normalizedStatuses)
    if (!parsedStatuses.success) {
      flash(t('taxi_fleet.config.trip_statuses.error.invalid', 'Fix trip status codes and labels before saving.'), 'error')
      return
    }

    const payload = { ...settings, tripStatuses: parsedStatuses.data }
    setSaving(true)
    try {
      const saved = await apiCallOrThrow<TaxiFleetSettingsResponse>(
        '/api/taxi_fleet/settings',
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        },
        { errorMessage: t('taxi_fleet.config.error.save', 'Failed to save taxi fleet settings.') },
      )
      setSettings(normalizeTaxiFleetSettingsResponse(saved))
      flash(t('taxi_fleet.config.success.save', 'Settings saved.'), 'success')
    } catch (err) {
      console.error('taxi fleet settings save', err)
      const msg = err instanceof Error ? err.message : t('taxi_fleet.config.error.save', 'Failed to save taxi fleet settings.')
      flash(msg, 'error')
    } finally {
      setSaving(false)
    }
  }, [settings, t])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        {t('taxi_fleet.config.loading', 'Loading settings…')}
      </div>
    )
  }

  const emailEventTitle: Record<(typeof TAXI_FLEET_CUSTOMER_EMAIL_EVENTS)[number], string> = {
    trip_created: t('taxi_fleet.config.emails.events.trip_created', 'New trip order'),
    trip_approved: t('taxi_fleet.config.emails.events.trip_approved', 'Trip approved'),
    trip_paid: t('taxi_fleet.config.emails.events.trip_paid', 'Trip paid'),
    trip_cancelled: t('taxi_fleet.config.emails.events.trip_cancelled', 'Trip cancelled'),
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        title={t('taxi_fleet.config.fleet.title', 'Fleet defaults')}
        description={t(
          'taxi_fleet.config.fleet.description',
          'Choose which resource type represents fleet vehicles and the default driver payout percent for new profiles.',
        )}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <Label className="text-sm font-medium">
              {t('taxi_fleet.config.fleet.resourceType', 'Vehicle resource type')}
            </Label>
            <ResourceTypeSearchField
              value={settings.resourceTypeId ?? ''}
              onChange={(next) => setSettings((current) => ({ ...current, resourceTypeId: next.trim() || null }))}
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              {t(
                'taxi_fleet.config.fleet.resourceTypeHelp',
                'Only resources of this type appear when assigning vehicles in trips and driver profiles. If the type is removed, all resources are available.',
              )}
              {' '}
              <Link href="/backend/resources/resource-types" className="underline">
                {t('taxi_fleet.config.fleet.manageResourceTypes', 'Manage resource types')}
              </Link>
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium">
              {t('taxi_fleet.config.fleet.defaultPayoutPercent', 'Default driver payout percent')}
            </Label>
            <PercentInputField
              value={String(settings.defaultPayoutPercent)}
              onChange={(next) =>
                setSettings((current) => ({
                  ...current,
                  defaultPayoutPercent: Number(next) || 0,
                }))
              }
              disabled={saving}
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title={t('taxi_fleet.config.trip_statuses.title', 'Trip statuses')}
        description={t(
          'taxi_fleet.config.trip_statuses.description',
          'Define trip lifecycle statuses and choose CRM notifications or customer emails to run when a trip enters each status.',
        )}
      >
        <TripStatusSettingsSection
          tripStatuses={settings.tripStatuses}
          disabled={saving}
          onChange={(tripStatuses) => setSettings((current) => ({ ...current, tripStatuses }))}
        />
      </SettingsSection>

      <SettingsSection
        title={t('taxi_fleet.config.paypal.title', 'PayPal integration')}
        description={t(
          'taxi_fleet.config.paypal.description',
          'Online payments for customer trip requests (mirrors Strapi PAYPAL_* and confirmation URLs).',
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="paypal-enabled" className="text-sm font-medium">
            {t('taxi_fleet.config.paypal.enabled', 'Enable PayPal')}
          </Label>
          <Switch
            id="paypal-enabled"
            checked={settings.paypal.enabled}
            disabled={saving}
            onCheckedChange={(checked) =>
              setSettings((current) => ({ ...current, paypal: { ...current.paypal, enabled: checked } }))
            }
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-sm font-medium">{t('taxi_fleet.config.paypal.clientId', 'Client ID')}</Label>
            <input
              type="text"
              className={CRUD_FORM_TEXT_INPUT_CLASS}
              value={settings.paypal.clientId}
              disabled={saving}
              onChange={(event) =>
                setSettings((current) => ({ ...current, paypal: { ...current.paypal, clientId: event.target.value } }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium">{t('taxi_fleet.config.paypal.clientSecret', 'Client secret')}</Label>
            <input
              type="password"
              className={CRUD_FORM_TEXT_INPUT_CLASS}
              value={settings.paypal.clientSecret}
              placeholder={settings.paypalClientSecretConfigured ? '********' : ''}
              disabled={saving}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  paypal: { ...current.paypal, clientSecret: event.target.value },
                }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium">{t('taxi_fleet.config.paypal.mode', 'Mode')}</Label>
            <select
              className={CRUD_FORM_SELECT_CLASS}
              value={settings.paypal.mode}
              disabled={saving}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  paypal: { ...current.paypal, mode: event.target.value as 'sandbox' | 'live' },
                }))
              }
            >
              <option value="sandbox">{t('taxi_fleet.config.paypal.modeSandbox', 'Sandbox')}</option>
              <option value="live">{t('taxi_fleet.config.paypal.modeLive', 'Live')}</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium">{t('taxi_fleet.config.paypal.currency', 'Currency')}</Label>
            <input
              type="text"
              className={CRUD_FORM_TEXT_INPUT_CLASS}
              value={settings.paypal.currency}
              disabled={saving}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  paypal: { ...current.paypal, currency: event.target.value.toUpperCase() },
                }))
              }
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-sm font-medium">
              {t('taxi_fleet.config.paypal.confirmationPageBase', 'Confirmation page base URL')}
            </Label>
            <input
              type="url"
              className={CRUD_FORM_TEXT_INPUT_CLASS}
              value={settings.paypal.confirmationPageBase}
              disabled={saving}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  paypal: { ...current.paypal, confirmationPageBase: event.target.value },
                }))
              }
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-sm font-medium">
              {t('taxi_fleet.config.paypal.paymentCancelUrl', 'Payment cancel URL')}
            </Label>
            <input
              type="url"
              className={CRUD_FORM_TEXT_INPUT_CLASS}
              value={settings.paypal.paymentCancelUrl}
              disabled={saving}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  paypal: { ...current.paypal, paymentCancelUrl: event.target.value },
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              {t('taxi_fleet.config.paypal.paymentCancelUrlHelp', 'Optional. You can use {requestId} in the URL.')}
            </p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title={t('taxi_fleet.config.calendar.title', 'Google Calendar integration')}
        description={t(
          'taxi_fleet.config.calendar.description',
          'Create calendar events when trips are confirmed or paid (mirrors Strapi GOOGLE_CALENDAR_* settings).',
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="calendar-enabled" className="text-sm font-medium">
            {t('taxi_fleet.config.calendar.enabled', 'Enable Google Calendar')}
          </Label>
          <Switch
            id="calendar-enabled"
            checked={settings.calendar.enabled}
            disabled={saving}
            onCheckedChange={(checked) =>
              setSettings((current) => ({ ...current, calendar: { ...current.calendar, enabled: checked } }))
            }
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-sm font-medium">{t('taxi_fleet.config.calendar.calendarId', 'Calendar ID')}</Label>
            <input
              type="text"
              className={CRUD_FORM_TEXT_INPUT_CLASS}
              value={settings.calendar.calendarId}
              disabled={saving}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  calendar: { ...current.calendar, calendarId: event.target.value },
                }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium">{t('taxi_fleet.config.calendar.timezone', 'Timezone')}</Label>
            <input
              type="text"
              className={CRUD_FORM_TEXT_INPUT_CLASS}
              value={settings.calendar.timezone}
              disabled={saving}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  calendar: { ...current.calendar, timezone: event.target.value },
                }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium">
              {t('taxi_fleet.config.calendar.serviceAccountEmail', 'Service account email')}
            </Label>
            <input
              type="email"
              className={CRUD_FORM_TEXT_INPUT_CLASS}
              value={settings.calendar.serviceAccountEmail}
              disabled={saving}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  calendar: { ...current.calendar, serviceAccountEmail: event.target.value },
                }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium">
              {t('taxi_fleet.config.calendar.defaultDurationMinutes', 'Default event duration (minutes)')}
            </Label>
            <input
              type="number"
              min={15}
              max={1440}
              className={CRUD_FORM_TEXT_INPUT_CLASS}
              value={settings.calendar.defaultDurationMinutes}
              disabled={saving}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  calendar: {
                    ...current.calendar,
                    defaultDurationMinutes: Number(event.target.value) || 60,
                  },
                }))
              }
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-sm font-medium">
              {t('taxi_fleet.config.calendar.privateKey', 'Service account private key')}
            </Label>
            <textarea
              className={`${CRUD_FORM_TEXT_INPUT_CLASS} min-h-[6rem] font-mono text-xs`}
              value={settings.calendar.serviceAccountPrivateKey}
              placeholder={settings.calendarPrivateKeyConfigured ? '********' : ''}
              disabled={saving}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  calendar: { ...current.calendar, serviceAccountPrivateKey: event.target.value },
                }))
              }
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title={t('taxi_fleet.config.emails.title', 'Customer email notifications')}
        description={t(
          'taxi_fleet.config.emails.description',
          'Templates sent to customers for fleet trip lifecycle events. Use {requestId} as a placeholder.',
        )}
      >
        <div className="space-y-1">
          <Label className="text-sm font-medium">{t('taxi_fleet.config.emails.from', 'Customer sender address')}</Label>
          <input
            type="email"
            className={CRUD_FORM_TEXT_INPUT_CLASS}
            value={settings.customerEmailFrom}
            disabled={saving}
            onChange={(event) => setSettings((current) => ({ ...current, customerEmailFrom: event.target.value }))}
          />
        </div>
        <div className="space-y-6">
          {TAXI_FLEET_CUSTOMER_EMAIL_EVENTS.map((eventId) => {
            const template = settings.customerEmails[eventId]
            return (
              <div key={eventId} className="rounded-md border border-border/70 p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">{emailEventTitle[eventId]}</h3>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`email-${eventId}`} className="text-xs text-muted-foreground">
                      {t('taxi_fleet.config.emails.enabled', 'Enabled')}
                    </Label>
                    <Switch
                      id={`email-${eventId}`}
                      checked={template.enabled}
                      disabled={saving}
                      onCheckedChange={(checked) =>
                        setSettings((current) => ({
                          ...current,
                          customerEmails: {
                            ...current.customerEmails,
                            [eventId]: { ...current.customerEmails[eventId], enabled: checked },
                          },
                        }))
                      }
                    />
                  </div>
                </div>
                <BilingualTemplateFields
                  value={template}
                  disabled={saving}
                  onChange={(next) =>
                    setSettings((current) => ({
                      ...current,
                      customerEmails: { ...current.customerEmails, [eventId]: next },
                    }))
                  }
                  labels={{
                    subjectPl: t('taxi_fleet.config.emails.subjectPl', 'Subject (PL)'),
                    subjectEn: t('taxi_fleet.config.emails.subjectEn', 'Subject (EN)'),
                    preheaderPl: t('taxi_fleet.config.emails.preheaderPl', 'Preheader (PL)'),
                    preheaderEn: t('taxi_fleet.config.emails.preheaderEn', 'Preheader (EN)'),
                    headingPl: t('taxi_fleet.config.emails.headingPl', 'Heading (PL)'),
                    headingEn: t('taxi_fleet.config.emails.headingEn', 'Heading (EN)'),
                    introPl: t('taxi_fleet.config.emails.introPl', 'Intro (PL)'),
                    introEn: t('taxi_fleet.config.emails.introEn', 'Intro (EN)'),
                    footerPl: t('taxi_fleet.config.emails.footerPl', 'Footer (PL)'),
                    footerEn: t('taxi_fleet.config.emails.footerEn', 'Footer (EN)'),
                  }}
                />
              </div>
            )
          })}
        </div>
      </SettingsSection>

      <div className="flex justify-end">
        <Button type="button" disabled={saving} onClick={() => void save()}>
          {saving ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
        </Button>
      </div>
    </div>
  )
}
