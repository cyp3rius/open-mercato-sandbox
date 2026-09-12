import type { ModuleCli } from '@open-mercato/shared/modules/registry'
import { readStorageDriverConfigFromEnv } from '@open-mercato/core/modules/attachments/lib/drivers'
import { parseGoogleDriveStorageConfig } from './lib/config'
import { createGoogleDriveClient } from './lib/client'
import { DriveFolderResolver } from './lib/folders'

function parseArgs(rest: string[]): Record<string, string> {
  const args: Record<string, string> = {}
  for (const part of rest) {
    if (!part.startsWith('--')) continue
    const [rawKey, ...rawValueParts] = part.replace(/^--/, '').split('=')
    if (!rawKey) continue
    args[rawKey] = rawValueParts.join('=') || '1'
  }
  return args
}

const verify: ModuleCli = {
  command: 'verify',
  async run(rest) {
    const args = parseArgs(rest)
    const config = parseGoogleDriveStorageConfig(readStorageDriverConfigFromEnv('google_drive'))
    const client = await createGoogleDriveClient(config)
    const folders = new DriveFolderResolver(client)

    const meta = await client.drive.files.get({
      fileId: config.rootFolderId,
      fields: 'id,name,mimeType,driveId',
      supportsAllDrives: client.supportsAllDrives,
    })

    console.log('Google Drive storage root:')
    console.log(`  id:   ${meta.data.id}`)
    console.log(`  name: ${meta.data.name}`)
    console.log(`  type: ${meta.data.mimeType}`)

    if (args.list === '1' || args.list === 'true') {
      const res = await client.drive.files.list({
        q: `'${config.rootFolderId}' in parents and trashed = false`,
        fields: 'files(id,name,mimeType)',
        pageSize: 50,
        supportsAllDrives: client.supportsAllDrives,
        includeItemsFromAllDrives: client.supportsAllDrives,
      })
      console.log('Children:')
      for (const file of res.data.files ?? []) {
        console.log(`  - ${file.name} (${file.mimeType}) [${file.id}]`)
      }
    }

    if (typeof args.ensurePartition === 'string' && args.ensurePartition.trim()) {
      const partition = args.ensurePartition.trim()
      const id = await folders.ensureFolderPath(config.rootFolderId, [partition])
      console.log(`Ensured partition folder "${partition}" → ${id}`)
    }
  },
}

export default [verify]
