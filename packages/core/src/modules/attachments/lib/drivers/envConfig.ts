const DRIVER_ENV_KEY = 'ATTACHMENTS_STORAGE_DRIVER'
const PROVIDER_MODULES_ENV_KEY = 'ATTACHMENTS_STORAGE_PROVIDER_MODULES'
const CONFIG_PREFIX = 'ATTACHMENTS_STORAGE_'

export function resolveDefaultStorageDriverKey(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = env[DRIVER_ENV_KEY]
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return fromEnv.trim()
  }
  return 'local'
}

/**
 * One active write backend per tenant / deployment.
 * MVP: process env (own-use / single-tenant).
 */
export function resolveTenantStorageDriverKey(
  _tenantId?: string | null,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return resolveDefaultStorageDriverKey(env)
}

export function parseProviderModuleSpecs(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env[PROVIDER_MODULES_ENV_KEY]
  if (typeof raw !== 'string' || raw.trim().length === 0) return []
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

/** `google_drive` → `GOOGLE_DRIVE` */
export function toStorageDriverEnvFragment(driverKey: string): string {
  return driverKey
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/(?:^_|_$)/g, '')
    .toUpperCase()
}

/** `FOLDER_ID` → `folderId` */
export function envSuffixToConfigKey(suffix: string): string {
  const parts = suffix.toLowerCase().split('_').filter(Boolean)
  if (parts.length === 0) return suffix.toLowerCase()
  return parts
    .map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('')
}

/**
 * Reads `ATTACHMENTS_STORAGE_<DRIVER>_*` into a flat config object.
 * Example: ATTACHMENTS_STORAGE_GOOGLE_DRIVE_FOLDER_ID=abc → { folderId: 'abc' }
 */
export function readStorageDriverConfigFromEnv(
  driverKey: string,
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const fragment = toStorageDriverEnvFragment(driverKey)
  const prefix = `${CONFIG_PREFIX}${fragment}_`
  const config: Record<string, string> = {}
  for (const [name, value] of Object.entries(env)) {
    if (typeof value !== 'string') continue
    if (!name.startsWith(prefix)) continue
    const suffix = name.slice(prefix.length)
    if (!suffix) continue
    config[envSuffixToConfigKey(suffix)] = value
  }
  return config
}

export const storageDriverEnvKeys = {
  driver: DRIVER_ENV_KEY,
  providerModules: PROVIDER_MODULES_ENV_KEY,
  configPrefix: CONFIG_PREFIX,
} as const
