import { parseBooleanWithDefault } from '@open-mercato/shared/lib/boolean'

export type WebPushVapidConfig = {
  publicKey: string
  privateKey: string
  subject: string
}

function trimEnv(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Feature flag — off by default so missing VAPID keys do not surface as 503. */
export function isWebPushEnabled(): boolean {
  return parseBooleanWithDefault(process.env.WEB_PUSH_ENABLED, false)
}

/** Server-side VAPID credentials. Returns null when disabled or keys missing. */
export function resolveWebPushVapidConfig(): WebPushVapidConfig | null {
  if (!isWebPushEnabled()) return null
  const publicKey =
    trimEnv(process.env.WEB_PUSH_VAPID_PUBLIC_KEY) ||
    trimEnv(process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY)
  const privateKey = trimEnv(process.env.WEB_PUSH_VAPID_PRIVATE_KEY)
  const subject = trimEnv(process.env.WEB_PUSH_VAPID_SUBJECT) || 'mailto:ops@localhost'
  if (!publicKey || !privateKey) return null
  return { publicKey, privateKey, subject }
}

/** Public key exposed to the driver PWA for `pushManager.subscribe`. */
export function resolveWebPushVapidPublicKey(): string | null {
  if (!isWebPushEnabled()) return null
  const key =
    trimEnv(process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY) ||
    trimEnv(process.env.WEB_PUSH_VAPID_PUBLIC_KEY)
  return key || null
}

/** True when the feature flag is on and VAPID keys are present. */
export function isWebPushConfigured(): boolean {
  return resolveWebPushVapidConfig() !== null
}
