/**
 * Small helpers for `apps/mercato/config/*.ts` provider files (and similar).
 *
 * @example
 * ```ts
 * import { env } from '@open-mercato/shared/lib/env'
 * export default { rootFolderId: env('MY_FOLDER_ID') }
 * ```
 */

export function env(name: string): string
export function env(name: string, fallback: string): string
export function env(name: string, fallback?: string): string {
  const value = process.env[name]
  if (typeof value === 'string' && value.length > 0) return value
  if (arguments.length >= 2) return fallback as string
  throw new Error(`Missing required environment variable: ${name}`)
}

export function envBool(name: string, fallback = false): boolean {
  const raw = process.env[name]
  if (raw == null || raw.trim() === '') return fallback
  const normalized = raw.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

export function envInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw == null || raw.trim() === '') return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}
