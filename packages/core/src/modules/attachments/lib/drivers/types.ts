export type StoreFilePayload = {
  partitionCode: string
  orgId: string | null | undefined
  tenantId: string | null | undefined
  fileName: string
  buffer: Buffer
}

export type StoredFile = {
  storagePath: string
  driverMeta?: Record<string, unknown> | null
}

export type ReadFileResult = {
  buffer: Buffer
  contentType?: string
}

export type LocalPathHandle = {
  filePath: string
  cleanup: () => Promise<void>
}

export interface StorageDriver {
  readonly key: string
  store(payload: StoreFilePayload): Promise<StoredFile>
  read(partitionCode: string, storagePath: string): Promise<ReadFileResult>
  delete(partitionCode: string, storagePath: string): Promise<void>
  toLocalPath(partitionCode: string, storagePath: string): Promise<LocalPathHandle>
}

/** Flat config map derived from ATTACHMENTS_STORAGE_<DRIVER>_* env vars. */
export type StorageDriverEnvConfig = Record<string, string>

/**
 * Contract for env-loadable storage providers.
 * Export as `storageDriverDefinition` (or default) from a module listed in
 * `ATTACHMENTS_STORAGE_PROVIDER_MODULES`.
 */
export type StorageDriverDefinition = {
  key: string
  create(config: StorageDriverEnvConfig): StorageDriver
}

export type StorageDriverFactoryFn = () => StorageDriver
