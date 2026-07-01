'use client'

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { NotificationDeliveryStrategySettingsProps } from '@open-mercato/core/modules/notifications/lib/deliveryStrategySettingsRegistry'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { Switch } from '@open-mercato/ui/primitives/switch'
import { NODEMAILER_TRANSPORT_KINDS, type NodemailerTransportKind } from '../lib/constants'

function readString(config: Record<string, unknown>, key: string): string {
  const value = config[key]
  return typeof value === 'string' ? value : ''
}

function readNumber(config: Record<string, unknown>, key: string): string {
  const value = config[key]
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

function readBoolean(config: Record<string, unknown>, key: string): boolean {
  return config[key] === true
}

function readSendmailArgs(config: Record<string, unknown>): string {
  const value = config.sendmailArgs
  if (!Array.isArray(value)) return ''
  return value.filter((item): item is string => typeof item === 'string').join(', ')
}

function readTransport(config: Record<string, unknown>): NodemailerTransportKind {
  const value = config.transport
  if (typeof value === 'string' && (NODEMAILER_TRANSPORT_KINDS as readonly string[]).includes(value)) {
    return value as NodemailerTransportKind
  }
  return 'sendmail'
}

function readTransportOptionsJson(config: Record<string, unknown>): string {
  const value = config.transportOptions
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ''
  }
}

export function NodemailerStrategySettings({
  config,
  onConfigChange,
}: NotificationDeliveryStrategySettingsProps) {
  const t = useT()
  const transport = readTransport(config)
  const [transportOptionsError, setTransportOptionsError] = React.useState<string | null>(null)

  const setString = (key: string, value: string) => {
    onConfigChange({ [key]: value.trim().length > 0 ? value : undefined })
  }

  const setNumber = (key: string, value: string) => {
    const parsed = Number.parseInt(value, 10)
    onConfigChange({ [key]: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined })
  }

  const setTransportOptionsJson = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      setTransportOptionsError(null)
      onConfigChange({ transportOptions: undefined })
      return
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setTransportOptionsError(t(
          'notifications.settings.custom.nodemailer.transportOptionsInvalid',
          'Transport options must be a JSON object.',
        ))
        return
      }
      setTransportOptionsError(null)
      onConfigChange({ transportOptions: parsed })
    } catch {
      setTransportOptionsError(t(
        'notifications.settings.custom.nodemailer.transportOptionsInvalid',
        'Transport options must be a JSON object.',
      ))
    }
  }

  return (
    <div className="grid gap-4 border-t pt-4 md:grid-cols-2">
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="nodemailer-transport">
          {t('notifications.settings.custom.nodemailer.transport', 'Transport')}
        </Label>
        <select
          id="nodemailer-transport"
          className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
          value={transport}
          onChange={(event) => onConfigChange({ transport: event.target.value })}
        >
          {NODEMAILER_TRANSPORT_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`notifications.settings.custom.nodemailer.transport.${kind}`, kind)}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          {t(
            'notifications.settings.custom.nodemailer.transportHint',
            'Unset fields fall back to environment variables when present.',
          )}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="nodemailer-from">{t('notifications.settings.email.from', 'From address')}</Label>
        <Input
          id="nodemailer-from"
          value={readString(config, 'from')}
          placeholder="notifications@example.com"
          onChange={(event) => setString('from', event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="nodemailer-reply-to">{t('notifications.settings.email.replyTo', 'Reply-to')}</Label>
        <Input
          id="nodemailer-reply-to"
          value={readString(config, 'replyTo')}
          placeholder="support@example.com"
          onChange={(event) => setString('replyTo', event.target.value)}
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="nodemailer-subject-prefix">{t('notifications.settings.email.subjectPrefix', 'Subject prefix')}</Label>
        <Input
          id="nodemailer-subject-prefix"
          value={readString(config, 'subjectPrefix')}
          placeholder="[CRM]"
          onChange={(event) => setString('subjectPrefix', event.target.value)}
        />
      </div>

      {transport === 'sendmail' ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="nodemailer-sendmail-path">
              {t('notifications.settings.custom.nodemailer.sendmailPath', 'Sendmail path')}
            </Label>
            <Input
              id="nodemailer-sendmail-path"
              value={readString(config, 'sendmailPath')}
              placeholder="/usr/sbin/sendmail"
              onChange={(event) => setString('sendmailPath', event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nodemailer-sendmail-args">
              {t('notifications.settings.custom.nodemailer.sendmailArgs', 'Sendmail arguments')}
            </Label>
            <Input
              id="nodemailer-sendmail-args"
              value={readSendmailArgs(config)}
              placeholder="-i,-t"
              onChange={(event) => {
                const args = event.target.value
                  .split(',')
                  .map((part) => part.trim())
                  .filter(Boolean)
                onConfigChange({ sendmailArgs: args.length > 0 ? args : undefined })
              }}
            />
            <p className="text-xs text-muted-foreground">
              {t('notifications.settings.custom.nodemailer.sendmailArgsHint', 'Comma-separated arguments passed to sendmail.')}
            </p>
          </div>
        </>
      ) : null}

      {transport === 'smtp' ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="nodemailer-smtp-host">{t('notifications.settings.custom.nodemailer.smtpHost', 'SMTP host')}</Label>
            <Input
              id="nodemailer-smtp-host"
              value={readString(config, 'host')}
              placeholder="smtp.example.com"
              onChange={(event) => setString('host', event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nodemailer-smtp-port">{t('notifications.settings.custom.nodemailer.smtpPort', 'SMTP port')}</Label>
            <Input
              id="nodemailer-smtp-port"
              type="number"
              min={1}
              value={readNumber(config, 'port')}
              placeholder="587"
              onChange={(event) => setNumber('port', event.target.value)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3 md:col-span-2">
            <div>
              <p className="text-sm font-medium">{t('notifications.settings.custom.nodemailer.smtpSecure', 'Use TLS (secure)')}</p>
            </div>
            <Switch
              checked={readBoolean(config, 'secure')}
              onCheckedChange={(checked) => onConfigChange({ secure: checked })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nodemailer-smtp-user">{t('notifications.settings.custom.nodemailer.smtpUser', 'SMTP user')}</Label>
            <Input
              id="nodemailer-smtp-user"
              value={readString(config, 'user')}
              onChange={(event) => setString('user', event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nodemailer-smtp-pass">{t('notifications.settings.custom.nodemailer.smtpPass', 'SMTP password')}</Label>
            <Input
              id="nodemailer-smtp-pass"
              type="password"
              autoComplete="new-password"
              value={readString(config, 'pass')}
              onChange={(event) => setString('pass', event.target.value)}
            />
          </div>
        </>
      ) : null}

      {transport === 'service' ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="nodemailer-service">{t('notifications.settings.custom.nodemailer.service', 'Service name')}</Label>
            <Input
              id="nodemailer-service"
              value={readString(config, 'service')}
              placeholder="gmail"
              onChange={(event) => setString('service', event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nodemailer-service-user">{t('notifications.settings.custom.nodemailer.smtpUser', 'SMTP user')}</Label>
            <Input
              id="nodemailer-service-user"
              value={readString(config, 'user')}
              onChange={(event) => setString('user', event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nodemailer-service-pass">{t('notifications.settings.custom.nodemailer.smtpPass', 'SMTP password')}</Label>
            <Input
              id="nodemailer-service-pass"
              type="password"
              autoComplete="new-password"
              value={readString(config, 'pass')}
              onChange={(event) => setString('pass', event.target.value)}
            />
          </div>
        </>
      ) : null}

      {transport === 'url' ? (
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="nodemailer-url">{t('notifications.settings.custom.nodemailer.url', 'Connection URL')}</Label>
          <Input
            id="nodemailer-url"
            value={readString(config, 'url')}
            placeholder="smtp://user:pass@smtp.example.com:587"
            onChange={(event) => setString('url', event.target.value)}
          />
        </div>
      ) : null}

      {transport === 'ses' ? (
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="nodemailer-ses-region">{t('notifications.settings.custom.nodemailer.sesRegion', 'AWS region')}</Label>
          <Input
            id="nodemailer-ses-region"
            value={readString(config, 'sesRegion')}
            placeholder="eu-central-1"
            onChange={(event) => setString('sesRegion', event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {t(
              'notifications.settings.custom.nodemailer.sesHint',
              'Requires @aws-sdk/client-ses and standard AWS credentials in the environment.',
            )}
          </p>
        </div>
      ) : null}

      {transport === 'options' || transport === 'json' || transport === 'stream' ? (
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="nodemailer-transport-options">
            {t('notifications.settings.custom.nodemailer.transportOptions', 'Transport options (JSON)')}
          </Label>
          <textarea
            id="nodemailer-transport-options"
            className="border-input bg-background ring-offset-background focus-visible:ring-ring min-h-28 w-full rounded-md border px-3 py-2 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
            value={readTransportOptionsJson(config)}
            placeholder='{"sendmail":true}'
            onChange={(event) => setTransportOptionsJson(event.target.value)}
          />
          {transportOptionsError ? (
            <p className="text-xs text-destructive">{transportOptionsError}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default NodemailerStrategySettings
