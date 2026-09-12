import type { DriveClient } from './client'
import { driveListParams } from './client'

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export class DriveFolderResolver {
  private readonly cache = new Map<string, string>()

  constructor(private readonly client: DriveClient) {}

  private cacheKey(parentId: string, name: string): string {
    return `${parentId}::${name}`
  }

  async findChildFolder(parentId: string, name: string): Promise<string | null> {
    const cached = this.cache.get(this.cacheKey(parentId, name))
    if (cached) return cached

    const q = [
      `'${escapeDriveQueryValue(parentId)}' in parents`,
      `name = '${escapeDriveQueryValue(name)}'`,
      `mimeType = 'application/vnd.google-apps.folder'`,
      'trashed = false',
    ].join(' and ')

    const res = await this.client.drive.files.list({
      q,
      fields: 'files(id,name)',
      pageSize: 1,
      spaces: 'drive',
      corpora: this.client.config.sharedDriveId ? 'drive' : undefined,
      driveId: this.client.config.sharedDriveId,
      ...driveListParams(this.client),
    })

    const id = res.data.files?.[0]?.id ?? null
    if (id) this.cache.set(this.cacheKey(parentId, name), id)
    return id
  }

  async findOrCreateChildFolder(parentId: string, name: string): Promise<string> {
    const existing = await this.findChildFolder(parentId, name)
    if (existing) return existing

    const created = await this.client.drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id',
      supportsAllDrives: this.client.supportsAllDrives,
    })

    const id = created.data.id
    if (!id) throw new Error(`Failed to create Drive folder "${name}" under ${parentId}`)
    this.cache.set(this.cacheKey(parentId, name), id)
    return id
  }

  async ensureFolderPath(rootFolderId: string, segments: string[]): Promise<string> {
    let parentId = rootFolderId
    for (const segment of segments) {
      parentId = await this.findOrCreateChildFolder(parentId, segment)
    }
    return parentId
  }

  async resolveExistingFolderPath(rootFolderId: string, segments: string[]): Promise<string | null> {
    let parentId = rootFolderId
    for (const segment of segments) {
      const next = await this.findChildFolder(parentId, segment)
      if (!next) return null
      parentId = next
    }
    return parentId
  }

  async findFileInFolder(parentId: string, fileName: string): Promise<{ id: string; mimeType?: string | null } | null> {
    const q = [
      `'${escapeDriveQueryValue(parentId)}' in parents`,
      `name = '${escapeDriveQueryValue(fileName)}'`,
      'trashed = false',
    ].join(' and ')

    const res = await this.client.drive.files.list({
      q,
      fields: 'files(id,name,mimeType)',
      pageSize: 1,
      spaces: 'drive',
      corpora: this.client.config.sharedDriveId ? 'drive' : undefined,
      driveId: this.client.config.sharedDriveId,
      ...driveListParams(this.client),
    })

    const file = res.data.files?.[0]
    if (!file?.id) return null
    return { id: file.id, mimeType: file.mimeType }
  }
}
