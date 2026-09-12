import { readFileSync } from 'fs'
import { GoogleAuth, type JWTInput } from 'google-auth-library'
import { google, type drive_v3 } from 'googleapis'
import type { GoogleDriveStorageConfig } from './config'

const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive']

function loadCredentialsJson(config: GoogleDriveStorageConfig): JWTInput {
  if (config.credentialsJson) {
    try {
      return JSON.parse(config.credentialsJson) as JWTInput
    } catch {
      throw new Error('ATTACHMENTS_STORAGE_GOOGLE_DRIVE_CREDENTIALS_JSON is not valid JSON')
    }
  }
  if (config.credentialsFile) {
    const raw = readFileSync(config.credentialsFile, 'utf8')
    try {
      return JSON.parse(raw) as JWTInput
    } catch {
      throw new Error(`Invalid JSON in credentials file: ${config.credentialsFile}`)
    }
  }
  throw new Error('Missing Google Drive credentials')
}

export type DriveClient = {
  drive: drive_v3.Drive
  config: GoogleDriveStorageConfig
  supportsAllDrives: boolean
}

export async function createGoogleDriveClient(config: GoogleDriveStorageConfig): Promise<DriveClient> {
  const credentials = loadCredentialsJson(config)
  const auth = new GoogleAuth({
    credentials,
    scopes: DRIVE_SCOPES,
  })
  const authClient = await auth.getClient()
  const drive = google.drive({ version: 'v3', auth: authClient as never })
  return {
    drive,
    config,
    supportsAllDrives: config.supportsAllDrives,
  }
}

export function driveListParams(client: DriveClient): {
  supportsAllDrives?: boolean
  includeItemsFromAllDrives?: boolean
} {
  if (!client.supportsAllDrives) return {}
  return { supportsAllDrives: true, includeItemsFromAllDrives: true }
}
