export const NODEMAILER_NOTIFICATION_STRATEGY_ID = 'nodemailer'

export const NODEMAILER_TRANSPORT_KINDS = [
  'sendmail',
  'smtp',
  'service',
  'url',
  'ses',
  'stream',
  'json',
  'options',
] as const

export type NodemailerTransportKind = (typeof NODEMAILER_TRANSPORT_KINDS)[number]
