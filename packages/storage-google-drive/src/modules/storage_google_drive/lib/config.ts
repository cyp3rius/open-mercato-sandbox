import { existsSync } from 'fs'
import path from 'path'
import type { StorageDriverEnvConfig } from '@open-mercato/core/modules/attachments/lib/drivers'
import {
  readGoogleDriveProviderFile,
  resolveGoogleDriveConfigFilePath,
  type GoogleDriveProviderFileConfig,
} from './configFile'

export type GoogleDriveStorageConfig = {
  /** Drive folder ID that becomes the attachments root (mirrors local storage/attachments). */
  rootFolderId: string
  /** Service account JSON (stringified). */
  credentialsJson?: string
  /** Absolute path to a service account JSON file. */
  credentialsFile?: string
  /** Optional Shared Drive ID when root lives on a shared drive. */
  sharedDriveId?: string
  supportsAllDrives: boolean
  /** Resolved provider config file path (for diagnostics). */
  configFilePath?: string
}

function firstNonEmpty(...values: Array<string | undefined | null>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  }
  return undefined
}

function parseSupportsAllDrives(value: string | boolean | undefined, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string' || value.trim().length === 0) return fallback
  return !['0', 'false', 'no', 'off'].includes(value.trim().toLowerCase())
}

/** Resolve credentialsFile relative to the provider config file directory. */
export function resolveCredentialsFilePath(
  credentialsFile: string | undefined,
  configFilePath: string | undefined,
  cwd: string = process.cwd(),
): string | undefined {
  if (!credentialsFile || !credentialsFile.trim()) return undefined
  const trimmed = credentialsFile.trim()
  if (path.isAbsolute(trimmed)) return trimmed
  const baseDir = configFilePath ? path.dirname(configFilePath) : cwd
  return path.resolve(baseDir, trimmed)
}

/** Conventional sidecar next to provider-google_drive.ts → provider-google_drive.credentials.json */
export function defaultCredentialsSidecarPath(configFilePath: string): string {
  const dir = path.dirname(configFilePath)
  const base = path.basename(configFilePath, path.extname(configFilePath))
  return path.join(dir, `${base}.credentials.json`)
}

export function parseGoogleDriveStorageConfig(
  config: StorageDriverEnvConfig,
  options?: { cwd?: string },
): GoogleDriveStorageConfig {
  const cwd = options?.cwd ?? process.cwd()
  const configFilePath = resolveGoogleDriveConfigFilePath({
    explicitPath: firstNonEmpty(config.configFile, config.providerConfigFile),
    cwd,
  })

  let fileConfig: GoogleDriveProviderFileConfig | null = null
  if (configFilePath) {
    fileConfig = readGoogleDriveProviderFile(configFilePath)
  }

  // Provider config file is primary (auto-discovered from ATTACHMENTS_STORAGE_DRIVER).
  // ATTACHMENTS_STORAGE_GOOGLE_DRIVE_* env values are fallbacks when the file omits a field.
  const rootFolderId = firstNonEmpty(
    fileConfig?.rootFolderId,
    fileConfig?.folderId,
    config.rootFolderId,
    config.folderId,
    config.rootFolder,
  )
  if (!rootFolderId) {
    throw new Error(
      'Google Drive storage requires rootFolderId in config/provider-google_drive.ts (auto-discovered when ATTACHMENTS_STORAGE_DRIVER=google_drive)',
    )
  }

  const credentialsFromEmbedded = fileConfig?.credentials
    ? JSON.stringify(fileConfig.credentials)
    : undefined

  let credentialsFile = resolveCredentialsFilePath(
    firstNonEmpty(fileConfig?.credentialsFile, config.credentialsFile, config.serviceAccountFile),
    configFilePath ?? undefined,
    cwd,
  )

  if (!credentialsFromEmbedded && !credentialsFile && !config.credentialsJson && configFilePath) {
    const sidecar = defaultCredentialsSidecarPath(configFilePath)
    if (existsSync(sidecar)) {
      credentialsFile = sidecar
    }
  }

  const credentialsJson = firstNonEmpty(credentialsFromEmbedded, config.credentialsJson, config.serviceAccountJson)

  if (!credentialsJson && !credentialsFile) {
    throw new Error(
      'Google Drive storage requires credentials in config/provider-google_drive.ts ' +
        '(embedded `credentials`, `credentialsFile`, or sidecar provider-google_drive.credentials.json)',
    )
  }

  const supportsFromFile =
    typeof fileConfig?.supportsAllDrives === 'string' || typeof fileConfig?.supportsAllDrives === 'boolean'
      ? fileConfig.supportsAllDrives
      : undefined
  const supportsAllDrives = parseSupportsAllDrives(
    supportsFromFile ?? firstNonEmpty(config.supportsAllDrives, config.supportsAllDrivesFlag),
    typeof fileConfig?.supportsAllDrives === 'boolean' ? fileConfig.supportsAllDrives : true,
  )

  return {
    rootFolderId,
    credentialsJson,
    credentialsFile,
    sharedDriveId: firstNonEmpty(
      fileConfig?.sharedDriveId,
      fileConfig?.driveId,
      config.sharedDriveId,
      config.driveId,
    ),
    supportsAllDrives,
    configFilePath: configFilePath ?? undefined,
  }
}
