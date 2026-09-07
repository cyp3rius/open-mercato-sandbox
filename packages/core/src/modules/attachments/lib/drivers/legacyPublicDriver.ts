import { promises as fs } from 'fs'
import path from 'path'
import { sanitizeStorageRelativePath } from './localDriver'
import type { LocalPathHandle, ReadFileResult, StorageDriver, StoreFilePayload, StoredFile } from './types'

export function resolveLegacyPublicAbsolutePath(storagePath: string): string {
  const safeRelative = sanitizeStorageRelativePath(storagePath)
  return path.join(process.cwd(), safeRelative)
}

export class LegacyPublicStorageDriver implements StorageDriver {
  readonly key = 'legacyPublic'

  async store(_payload: StoreFilePayload): Promise<StoredFile> {
    throw new Error('legacyPublic storage driver is read-only')
  }

  async read(_partitionCode: string, storagePath: string): Promise<ReadFileResult> {
    const absolutePath = resolveLegacyPublicAbsolutePath(storagePath)
    const buffer = await fs.readFile(absolutePath)
    return { buffer }
  }

  async delete(_partitionCode: string, storagePath: string): Promise<void> {
    const absolutePath = resolveLegacyPublicAbsolutePath(storagePath)
    try {
      await fs.unlink(absolutePath)
    } catch {
      // best-effort removal
    }
  }

  async toLocalPath(_partitionCode: string, storagePath: string): Promise<LocalPathHandle> {
    return {
      filePath: resolveLegacyPublicAbsolutePath(storagePath),
      cleanup: async () => {},
    }
  }
}

export const legacyPublicStorageDriver = new LegacyPublicStorageDriver()
