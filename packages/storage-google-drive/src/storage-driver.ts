import type { StorageDriverDefinition, StorageDriverEnvConfig } from '@open-mercato/core/modules/attachments/lib/drivers'
import { parseGoogleDriveStorageConfig } from './modules/storage_google_drive/lib/config'
import { GoogleDriveStorageDriver } from './modules/storage_google_drive/lib/driver'

export const storageDriverDefinition: StorageDriverDefinition = {
  key: 'google_drive',
  create(config: StorageDriverEnvConfig) {
    const parsed = parseGoogleDriveStorageConfig(config)
    return new GoogleDriveStorageDriver(parsed)
  },
}

export default storageDriverDefinition
