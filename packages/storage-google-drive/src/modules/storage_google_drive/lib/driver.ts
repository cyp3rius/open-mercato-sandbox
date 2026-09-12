import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { Readable } from 'stream'
import type {
  LocalPathHandle,
  ReadFileResult,
  StorageDriver,
  StoreFilePayload,
  StoredFile,
} from '@open-mercato/core/modules/attachments/lib/drivers'
import type { GoogleDriveStorageConfig } from './config'
import { createGoogleDriveClient, type DriveClient } from './client'
import { DriveFolderResolver } from './folders'
import {
  buildRelativeStoragePath,
  buildStoredFileName,
  resolveDriveFolderSegments,
  resolveUploadFolderSegments,
} from './paths'

function guessMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'pdf':
      return 'application/pdf'
    case 'txt':
      return 'text/plain'
    case 'csv':
      return 'text/csv'
    case 'json':
      return 'application/json'
    case 'md':
      return 'text/markdown'
    default:
      return 'application/octet-stream'
  }
}

export class GoogleDriveStorageDriver implements StorageDriver {
  readonly key = 'google_drive'

  private clientPromise: Promise<DriveClient> | null = null
  private folders: DriveFolderResolver | null = null

  constructor(private readonly config: GoogleDriveStorageConfig) {}

  private async getClient(): Promise<DriveClient> {
    if (!this.clientPromise) {
      this.clientPromise = createGoogleDriveClient(this.config)
    }
    return this.clientPromise
  }

  private async getFolders(): Promise<DriveFolderResolver> {
    if (!this.folders) {
      const client = await this.getClient()
      this.folders = new DriveFolderResolver(client)
    }
    return this.folders
  }

  async store(payload: StoreFilePayload): Promise<StoredFile> {
    const client = await this.getClient()
    const folders = await this.getFolders()
    const storedName = buildStoredFileName(payload.fileName)
    const storagePath = buildRelativeStoragePath({
      orgId: payload.orgId,
      tenantId: payload.tenantId,
      storedName,
    })
    const folderSegments = resolveUploadFolderSegments({
      partitionCode: payload.partitionCode,
      orgId: payload.orgId,
      tenantId: payload.tenantId,
    })
    const parentId = await folders.ensureFolderPath(this.config.rootFolderId, folderSegments)
    const mimeType = guessMimeType(storedName)

    // Do not set Drive appProperties with OM storagePath: Drive limits each
    // property to 124 bytes (key + value). org_/tenant_ UUID paths exceed that
    // and files.create fails after folders were already created.
    let created
    try {
      created = await client.drive.files.create({
        requestBody: {
          name: storedName,
          parents: [parentId],
        },
        media: {
          mimeType,
          body: Readable.from(payload.buffer),
        },
        fields: 'id,name',
        supportsAllDrives: client.supportsAllDrives,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Google Drive upload failed for ${storagePath}: ${message}`, { cause: error })
    }

    const fileId = created.data.id
    if (!fileId) {
      throw new Error(`Google Drive upload returned no file id for ${storagePath}`)
    }

    return {
      storagePath,
      driverMeta: {
        fileId,
        rootFolderId: this.config.rootFolderId,
      },
    }
  }

  private async resolveFile(
    partitionCode: string,
    storagePath: string,
  ): Promise<{ id: string; mimeType?: string | null }> {
    const folders = await this.getFolders()
    const { folderSegments, fileName } = resolveDriveFolderSegments(partitionCode, storagePath)
    const parentId = await folders.resolveExistingFolderPath(this.config.rootFolderId, folderSegments)
    if (!parentId) {
      throw new Error(`Google Drive folder path not found for ${partitionCode}/${storagePath}`)
    }
    const file = await folders.findFileInFolder(parentId, fileName)
    if (!file) {
      throw new Error(`Google Drive file not found: ${partitionCode}/${storagePath}`)
    }
    return file
  }

  async read(partitionCode: string, storagePath: string): Promise<ReadFileResult> {
    const client = await this.getClient()
    const file = await this.resolveFile(partitionCode, storagePath)
    const res = await client.drive.files.get(
      {
        fileId: file.id,
        alt: 'media',
        supportsAllDrives: client.supportsAllDrives,
      },
      { responseType: 'arraybuffer' },
    )
    const data = res.data as ArrayBuffer | Buffer | string
    const buffer = Buffer.isBuffer(data)
      ? data
      : typeof data === 'string'
        ? Buffer.from(data)
        : Buffer.from(data)
    return {
      buffer,
      contentType: file.mimeType ?? undefined,
    }
  }

  async delete(partitionCode: string, storagePath: string): Promise<void> {
    try {
      const client = await this.getClient()
      const file = await this.resolveFile(partitionCode, storagePath)
      await client.drive.files.delete({
        fileId: file.id,
        supportsAllDrives: client.supportsAllDrives,
      })
    } catch {
      // best-effort removal (parity with local driver)
    }
  }

  async toLocalPath(partitionCode: string, storagePath: string): Promise<LocalPathHandle> {
    const { buffer } = await this.read(partitionCode, storagePath)
    const { fileName } = resolveDriveFolderSegments(partitionCode, storagePath)
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'om-gdrive-'))
    const filePath = path.join(dir, fileName)
    await fs.writeFile(filePath, buffer)
    return {
      filePath,
      cleanup: async () => {
        try {
          await fs.rm(dir, { recursive: true, force: true })
        } catch {
          // ignore
        }
      },
    }
  }
}
