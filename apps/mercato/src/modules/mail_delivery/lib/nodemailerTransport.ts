import nodemailer from 'nodemailer'
import type { NodemailerStrategyRuntimeConfig } from './nodemailerConfig'

type TransportConfig = Record<string, unknown>

function mergeTransportOptions(
  base: TransportConfig,
  extras?: Record<string, unknown>,
): TransportConfig {
  if (!extras || Object.keys(extras).length === 0) return base
  return { ...base, ...extras }
}

function buildSendmailTransportOptions(
  config: NodemailerStrategyRuntimeConfig,
): TransportConfig {
  const sendmailOptions: Record<string, unknown> = {}

  if (config.sendmailPath) {
    sendmailOptions.path = config.sendmailPath
  }
  if (config.sendmailArgs && config.sendmailArgs.length > 0) {
    sendmailOptions.args = config.sendmailArgs
  }

  const base = Object.keys(sendmailOptions).length > 0
    ? { sendmail: sendmailOptions }
    : { sendmail: true }

  return mergeTransportOptions(base, config.transportOptions)
}

function buildSmtpTransportOptions(
  config: NodemailerStrategyRuntimeConfig,
): TransportConfig {
  if (!config.host) {
    throw new Error('NODEMAILER_SMTP_NOT_CONFIGURED: set SMTP_HOST (and credentials if required)')
  }

  const auth = config.user && config.pass
    ? { user: config.user, pass: config.pass }
    : undefined

  const base: TransportConfig = {
    host: config.host,
    port: config.port ?? 587,
    secure: config.secure ?? false,
    ...(auth ? { auth } : {}),
  }

  return mergeTransportOptions(base, config.transportOptions)
}

function buildServiceTransportOptions(
  config: NodemailerStrategyRuntimeConfig,
): TransportConfig {
  if (!config.service) {
    throw new Error('NODEMAILER_SERVICE_NOT_CONFIGURED: set SMTP_SERVICE (e.g. gmail) or transport.service in strategy config')
  }

  const auth = config.user && config.pass
    ? { user: config.user, pass: config.pass }
    : undefined

  const base: TransportConfig = {
    service: config.service,
    ...(auth ? { auth } : {}),
  }

  return mergeTransportOptions(base, config.transportOptions)
}

function buildUrlTransportTarget(config: NodemailerStrategyRuntimeConfig): string {
  if (!config.url) {
    throw new Error('NODEMAILER_URL_NOT_CONFIGURED: set NODEMAILER_URL (e.g. smtp://user:pass@host:587) or transport.url in strategy config')
  }
  return config.url
}

function buildStreamTransportOptions(
  config: NodemailerStrategyRuntimeConfig,
): TransportConfig {
  const base: TransportConfig = {
    streamTransport: true,
    buffer: true,
    newline: 'unix',
  }

  return mergeTransportOptions(base, config.transportOptions)
}

function buildJsonTransportOptions(
  config: NodemailerStrategyRuntimeConfig,
): TransportConfig {
  const base: TransportConfig = { json: true }
  return mergeTransportOptions(base, config.transportOptions)
}

function buildRawOptionsTransport(
  config: NodemailerStrategyRuntimeConfig,
): TransportConfig {
  if (!config.transportOptions || typeof config.transportOptions !== 'object') {
    throw new Error(
      'NODEMAILER_OPTIONS_NOT_CONFIGURED: set NODEMAILER_TRANSPORT_OPTIONS JSON or transport.transportOptions in strategy config',
    )
  }

  return config.transportOptions as TransportConfig
}

function buildSesTransportOptions(
  config: NodemailerStrategyRuntimeConfig,
): TransportConfig {
  let sesModule: {
    SESClient: new (options: { region: string }) => unknown
    SendRawEmailCommand: unknown
  }

  try {
    // Optional dependency — only required when transport=ses
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sesModule = require('@aws-sdk/client-ses')
  } catch {
    throw new Error(
      'NODEMAILER_SES_UNAVAILABLE: install @aws-sdk/client-ses or use transport "options" with a preconfigured SES client',
    )
  }

  const region = config.sesRegion
    ?? process.env.AWS_REGION
    ?? process.env.AWS_DEFAULT_REGION
    ?? 'us-east-1'

  const ses = new sesModule.SESClient({ region })

  const base: TransportConfig = {
    SES: { ses, aws: { SendRawEmailCommand: sesModule.SendRawEmailCommand } },
  }

  return mergeTransportOptions(base, config.transportOptions)
}

export type NodemailerTransportTarget = string | TransportConfig

export function buildNodemailerTransportTarget(
  config: NodemailerStrategyRuntimeConfig,
): NodemailerTransportTarget {
  switch (config.transport) {
    case 'sendmail':
      return buildSendmailTransportOptions(config)
    case 'smtp':
      return buildSmtpTransportOptions(config)
    case 'service':
      return buildServiceTransportOptions(config)
    case 'url':
      return buildUrlTransportTarget(config)
    case 'stream':
      return buildStreamTransportOptions(config)
    case 'json':
      return buildJsonTransportOptions(config)
    case 'options':
      return buildRawOptionsTransport(config)
    case 'ses':
      return buildSesTransportOptions(config)
    default:
      return buildSendmailTransportOptions(config)
  }
}

let cachedTransportKey: string | null = null
let cachedTransport: nodemailer.Transporter | null = null

export function getNodemailerTransport(
  config: NodemailerStrategyRuntimeConfig,
): nodemailer.Transporter {
  const target = buildNodemailerTransportTarget(config)
  const cacheKey = typeof target === 'string' ? target : JSON.stringify(target)

  if (cachedTransport && cachedTransportKey === cacheKey) {
    return cachedTransport
  }

  cachedTransport = nodemailer.createTransport(target as Parameters<typeof nodemailer.createTransport>[0])
  cachedTransportKey = cacheKey
  return cachedTransport
}

export function resetNodemailerTransportCache(): void {
  cachedTransport = null
  cachedTransportKey = null
}
