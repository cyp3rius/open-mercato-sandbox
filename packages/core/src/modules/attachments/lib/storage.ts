import { getStorageDriverFactory } from './drivers/driverFactory'
import { resolveLocalAbsolutePath } from './drivers/localDriver'
import { resolveLegacyPublicAbsolutePath } from './drivers/legacyPublicDriver'
import { resolvePartitionRoot } from './partitionRoot'

export { resolvePartitionRoot }

export type StorePartitionFilePayload = {
  partitionCode: string
  orgId: string | null | undefined
  tenantId: string | null | undefined
  fileName: string
  buffer: Buffer
}

export type StoredPartitionFile = {
  storagePath: string
  absolutePath: string
  fileName: string
}

/**
 * @deprecated Prefer `getStorageDriverFactory().resolveDefault(...).store(...)`.
 * Kept for external callers (e.g. sync packages). Always uses the local driver path layout.
 */
export async function storePartitionFile(payload: StorePartitionFilePayload): Promise<StoredPartitionFile> {
  const driver = getStorageDriverFactory().resolve('local')
  const stored = await driver.store(payload)
  const { filePath } = await driver.toLocalPath(payload.partitionCode, stored.storagePath)
  const fileName = stored.storagePath.split('/').pop() || payload.fileName
  return {
    storagePath: stored.storagePath,
    absolutePath: filePath,
    fileName,
  }
}

/**
 * @deprecated Prefer `getStorageDriverFactory().resolve(driver).toLocalPath(...)` or `.read(...)`.
 */
export function resolveAttachmentAbsolutePath(
  partitionCode: string,
  storagePath: string,
  storageDriver?: string | null
): string {
  if (storageDriver === 'legacyPublic') {
    return resolveLegacyPublicAbsolutePath(storagePath)
  }
  return resolveLocalAbsolutePath(partitionCode, storagePath)
}

/**
 * @deprecated Prefer `getStorageDriverFactory().resolve(driver).delete(...)`.
 */
export async function deletePartitionFile(
  partitionCode: string,
  storagePath: string,
  storageDriver?: string | null
): Promise<void> {
  const driver = getStorageDriverFactory().resolve(storageDriver)
  await driver.delete(partitionCode, storagePath)
}
