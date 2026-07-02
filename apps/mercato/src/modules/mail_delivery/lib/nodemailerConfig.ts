import { parseBooleanWithDefault } from '@open-mercato/shared/lib/boolean'
import { resolveDefaultEmailFromAddress } from '@open-mercato/shared/lib/email/config'
import { NODEMAILER_TRANSPORT_KINDS, type NodemailerTransportKind } from './constants'

export { NODEMAILER_TRANSPORT_KINDS, type NodemailerTransportKind } from './constants'

export type NodemailerStrategyRuntimeConfig = {
  transport: NodemailerTransportKind
  from?: string
  replyTo?: string
  subjectPrefix?: string
  host?: string
  port?: number
  secure?: boolean
  user?: string
  pass?: string
  service?: string
  url?: string
  sendmailPath?: string
  sendmailArgs?: string[]
  sesRegion?: string
  directSmtpPort?: number
  directDevHost?: string
  directDevPort?: number
  transportOptions?: Record<string, unknown>
}

function normalizeEnvString(value: string | undefined | null): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function parsePort(value: string | undefined): number | undefined {
  const normalized = normalizeEnvString(value)
  if (!normalized) return undefined
  const parsed = Number.parseInt(normalized, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function parseSendmailArgs(value: string | undefined): string[] | undefined {
  const normalized = normalizeEnvString(value)
  if (!normalized) return undefined
  const args = normalized.split(',').map((part) => part.trim()).filter(Boolean)
  return args.length > 0 ? args : undefined
}

function parseTransportOptionsJson(value: string | undefined): Record<string, unknown> | undefined {
  const normalized = normalizeEnvString(value)
  if (!normalized) return undefined

  let parsed: unknown
  try {
    parsed = JSON.parse(normalized)
  } catch {
    throw new Error('NODEMAILER_TRANSPORT_OPTIONS_INVALID: must be valid JSON')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('NODEMAILER_TRANSPORT_OPTIONS_INVALID: must be a JSON object')
  }

  return parsed as Record<string, unknown>
}

function normalizeTransportKind(value: string | undefined): NodemailerTransportKind | undefined {
  const normalized = normalizeEnvString(value)?.toLowerCase()
  if (!normalized) return undefined
  if ((NODEMAILER_TRANSPORT_KINDS as readonly string[]).includes(normalized)) {
    return normalized as NodemailerTransportKind
  }
  return undefined
}

function resolveTransportKind(
  overrides: Record<string, unknown>,
): NodemailerTransportKind {
  const fromOverride = typeof overrides.transport === 'string'
    ? normalizeTransportKind(overrides.transport)
    : undefined
  if (fromOverride) return fromOverride

  const fromEnv = normalizeTransportKind(process.env.NODEMAILER_TRANSPORT)
  if (fromEnv) return fromEnv

  if (normalizeEnvString(process.env.SMTP_HOST)) {
    return 'smtp'
  }

  return 'sendmail'
}

function readStringOverride(
  overrides: Record<string, unknown>,
  key: string,
  envValue: string | undefined,
): string | undefined {
  return normalizeEnvString(typeof overrides[key] === 'string' ? overrides[key] as string : undefined)
    ?? normalizeEnvString(envValue)
}

function readTransportOptions(
  overrides: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const overrideOptions = overrides.transportOptions
  if (overrideOptions && typeof overrideOptions === 'object' && !Array.isArray(overrideOptions)) {
    return overrideOptions as Record<string, unknown>
  }

  return parseTransportOptionsJson(process.env.NODEMAILER_TRANSPORT_OPTIONS)
}

export function isNodemailerDeliveryEnabledByDefault(): boolean {
  return parseBooleanWithDefault(
    process.env.NOTIFICATIONS_NODEMAILER_ENABLED ?? process.env.NOTIFICATIONS_SMTP_ENABLED,
    false,
  )
}

export function resolveNodemailerStrategyConfig(
  strategyConfig: unknown,
): NodemailerStrategyRuntimeConfig {
  const overrides =
    strategyConfig && typeof strategyConfig === 'object' && !Array.isArray(strategyConfig)
      ? (strategyConfig as Record<string, unknown>)
      : {}

  const transport = resolveTransportKind(overrides)
  const host = readStringOverride(overrides, 'host', process.env.SMTP_HOST)
  const port = typeof overrides.port === 'number' && overrides.port > 0
    ? overrides.port
    : parsePort(process.env.SMTP_PORT)
  const secure = typeof overrides.secure === 'boolean'
    ? overrides.secure
    : parseBooleanWithDefault(process.env.SMTP_SECURE, false)
  const user = readStringOverride(overrides, 'user', process.env.SMTP_USER)
  const pass = readStringOverride(overrides, 'pass', process.env.SMTP_PASS)
  const service = readStringOverride(overrides, 'service', process.env.SMTP_SERVICE)
  const url = readStringOverride(overrides, 'url', process.env.NODEMAILER_URL)
  const sendmailPath = readStringOverride(overrides, 'sendmailPath', process.env.SENDMAIL_PATH)
  const sendmailArgs = Array.isArray(overrides.sendmailArgs)
    ? overrides.sendmailArgs.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : parseSendmailArgs(process.env.SENDMAIL_ARGS)
  const sesRegion = readStringOverride(overrides, 'sesRegion', process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION)
  const from = readStringOverride(overrides, 'from', undefined) ?? resolveDefaultEmailFromAddress()
  const replyTo = readStringOverride(
    overrides,
    'replyTo',
    process.env.NOTIFICATIONS_EMAIL_REPLY_TO || process.env.ADMIN_EMAIL,
  )
  const subjectPrefix = readStringOverride(
    overrides,
    'subjectPrefix',
    process.env.NOTIFICATIONS_EMAIL_SUBJECT_PREFIX,
  )
  const transportOptions = readTransportOptions(overrides)
  const directSmtpPort = typeof overrides.directSmtpPort === 'number' && overrides.directSmtpPort > 0
    ? overrides.directSmtpPort
    : parsePort(process.env.NODEMAILER_DIRECT_SMTP_PORT) ?? (transport === 'direct' ? 25 : undefined)
  const directDevHost = readStringOverride(overrides, 'directDevHost', process.env.NODEMAILER_DIRECT_DEV_HOST)
  const directDevPort = typeof overrides.directDevPort === 'number' && overrides.directDevPort > 0
    ? overrides.directDevPort
    : parsePort(process.env.NODEMAILER_DIRECT_DEV_PORT)

  return {
    transport,
    host,
    port,
    secure,
    user,
    pass,
    service,
    url,
    sendmailPath,
    sendmailArgs,
    sesRegion,
    from,
    replyTo,
    subjectPrefix,
    directSmtpPort,
    directDevHost,
    directDevPort,
    transportOptions,
  }
}

export { getNodemailerTransport, resetNodemailerTransportCache } from './nodemailerTransport'
