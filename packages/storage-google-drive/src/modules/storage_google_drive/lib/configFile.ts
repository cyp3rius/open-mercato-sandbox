import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { createRequire } from 'module'

export const GOOGLE_DRIVE_PROVIDER_CONFIG_BASENAME = 'provider-google_drive'

export const GOOGLE_DRIVE_PROVIDER_CONFIG_EXTENSIONS = ['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs', '.json'] as const

export type GoogleDriveProviderFileConfig = {
  rootFolderId?: string
  folderId?: string
  sharedDriveId?: string
  driveId?: string
  supportsAllDrives?: boolean | string
  /** Service account key object (preferred). */
  credentials?: Record<string, unknown>
  /** Absolute/relative path to a separate SA JSON (optional). */
  credentialsFile?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function requireFromCwd() {
  return createRequire(path.join(process.cwd(), 'package.json'))
}

let tsxRegistered = false

function ensureTsxRegistered(): void {
  if (tsxRegistered) return
  try {
    const require = requireFromCwd()
    const api = require('tsx/cjs/api') as { register: () => void }
    api.register()
    tsxRegistered = true
  } catch (error) {
    throw new Error(
      `Failed to load TypeScript provider config (tsx required). Install tsx or use a .json/.js config. ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

/**
 * Default lookup order for provider-google_drive.{ts,js,json} (first existing wins).
 * Prefer `.ts` so configs can call `env()`.
 * Override with ATTACHMENTS_STORAGE_GOOGLE_DRIVE_CONFIG_FILE.
 */
export function defaultGoogleDriveConfigFileCandidates(cwd: string = process.cwd()): string[] {
  const bases = [
    path.resolve(cwd, 'config', GOOGLE_DRIVE_PROVIDER_CONFIG_BASENAME),
    path.resolve(cwd, 'mercato', 'config', GOOGLE_DRIVE_PROVIDER_CONFIG_BASENAME),
    path.resolve(cwd, 'apps', 'mercato', 'config', GOOGLE_DRIVE_PROVIDER_CONFIG_BASENAME),
  ]
  const out: string[] = []
  for (const base of bases) {
    for (const ext of GOOGLE_DRIVE_PROVIDER_CONFIG_EXTENSIONS) {
      out.push(`${base}${ext}`)
    }
  }
  return out
}

export function resolveGoogleDriveConfigFilePath(options?: {
  explicitPath?: string | null
  cwd?: string
}): string | null {
  const cwd = options?.cwd ?? process.cwd()
  const explicit = options?.explicitPath?.trim()
  if (explicit) {
    return path.isAbsolute(explicit) ? explicit : path.resolve(cwd, explicit)
  }
  for (const candidate of defaultGoogleDriveConfigFileCandidates(cwd)) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

function normalizeModuleExport(moduleExports: unknown): unknown {
  if (!isRecord(moduleExports)) return moduleExports
  if ('default' in moduleExports) return moduleExports.default
  if ('config' in moduleExports) return moduleExports.config
  if ('storageDriverConfig' in moduleExports) return moduleExports.storageDriverConfig
  return moduleExports
}

function loadConfigModule(filePath: string): unknown {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.json') {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  }

  if (['.ts', '.mts', '.cts'].includes(ext)) {
    ensureTsxRegistered()
  }

  if (!['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs'].includes(ext)) {
    throw new Error(`Unsupported Google Drive provider config extension: ${ext} (${filePath})`)
  }

  const require = requireFromCwd()
  try {
    const resolved = require.resolve(filePath)
    delete require.cache[resolved]
  } catch {
    // resolve may fail for some ESM paths; require below will surface the error
  }
  return normalizeModuleExport(require(filePath))
}

export function normalizeGoogleDriveProviderConfig(raw: unknown, filePath: string): GoogleDriveProviderFileConfig {
  if (!isRecord(raw)) {
    throw new Error(`Google Drive provider config must export an object: ${filePath}`)
  }

  // Allow dropping a raw service-account key file as the provider config
  // (rootFolderId must then come from env).
  if (raw.type === 'service_account' && typeof raw.client_email === 'string') {
    return { credentials: raw }
  }

  const credentials = isRecord(raw.credentials) ? raw.credentials : undefined
  const credentialsFile =
    typeof raw.credentialsFile === 'string' && raw.credentialsFile.trim()
      ? raw.credentialsFile.trim()
      : undefined

  return {
    rootFolderId: typeof raw.rootFolderId === 'string' ? raw.rootFolderId : undefined,
    folderId: typeof raw.folderId === 'string' ? raw.folderId : undefined,
    sharedDriveId: typeof raw.sharedDriveId === 'string' ? raw.sharedDriveId : undefined,
    driveId: typeof raw.driveId === 'string' ? raw.driveId : undefined,
    supportsAllDrives:
      typeof raw.supportsAllDrives === 'boolean' || typeof raw.supportsAllDrives === 'string'
        ? raw.supportsAllDrives
        : undefined,
    credentials,
    credentialsFile,
  }
}

export function readGoogleDriveProviderFile(filePath: string): GoogleDriveProviderFileConfig {
  let raw: unknown
  try {
    raw = loadConfigModule(filePath)
  } catch (error) {
    throw new Error(
      `Invalid Google Drive provider config at ${filePath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
  return normalizeGoogleDriveProviderConfig(raw, filePath)
}
