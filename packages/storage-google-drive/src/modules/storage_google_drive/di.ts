import { getStorageDriverFactory } from '@open-mercato/core/modules/attachments/lib/drivers'
import type { AppContainer } from '@open-mercato/shared/lib/di/container'
import { storageDriverDefinition } from '../../storage-driver'

/**
 * When the module is enabled in modules.ts, register the definition so
 * ATTACHMENTS_STORAGE_DRIVER=google_drive works without PROVIDER_MODULES.
 * Env-only installs can instead set:
 *   ATTACHMENTS_STORAGE_PROVIDER_MODULES=@open-mercato/storage-google-drive/storage-driver
 */
export function register(_container: AppContainer) {
  getStorageDriverFactory().registerDefinition(storageDriverDefinition)
}
