import { localStorageDriver } from './localDriver'
import { legacyPublicStorageDriver } from './legacyPublicDriver'
import {
  readStorageDriverConfigFromEnv,
  resolveDefaultStorageDriverKey,
  resolveTenantStorageDriverKey,
} from './envConfig'
import { loadStorageDriverDefinitionsFromEnv } from './loadProviders'
import type { StorageDriver, StorageDriverDefinition, StorageDriverFactoryFn } from './types'

export { resolveDefaultStorageDriverKey, resolveTenantStorageDriverKey }

export class StorageDriverFactory {
  private readonly custom = new Map<string, StorageDriverFactoryFn>()
  private readonly definitions = new Map<string, StorageDriverDefinition>()
  private readonly instances = new Map<string, StorageDriver>()
  private providersLoaded = false
  private readonly env: NodeJS.ProcessEnv

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.env = env
  }

  /**
   * Escape hatch for tests. Production providers should load via
   * ATTACHMENTS_STORAGE_PROVIDER_MODULES + ATTACHMENTS_STORAGE_<DRIVER>_*.
   */
  register(key: string, create: StorageDriverFactoryFn): void {
    const normalized = key.trim()
    if (!normalized) {
      throw new Error('Storage driver key is required')
    }
    this.custom.set(normalized, create)
    this.instances.delete(normalized)
  }

  /** Register a definition (same contract as env-loaded modules). */
  registerDefinition(definition: StorageDriverDefinition): void {
    const key = definition.key.trim()
    if (!key) throw new Error('Storage driver definition key is required')
    this.definitions.set(key, definition)
    this.instances.delete(key)
  }

  ensureProvidersLoaded(): void {
    if (this.providersLoaded) return
    this.providersLoaded = true
    try {
      const loaded = loadStorageDriverDefinitionsFromEnv(this.env)
      for (const [key, definition] of loaded) {
        this.definitions.set(key, definition)
      }
    } catch (error) {
      console.error('[attachments.storage] Failed to load ATTACHMENTS_STORAGE_PROVIDER_MODULES', error)
      throw error
    }
  }

  resolve(driverKey?: string | null): StorageDriver {
    this.ensureProvidersLoaded()
    const key = typeof driverKey === 'string' && driverKey.trim().length > 0 ? driverKey.trim() : 'local'

    const cached = this.instances.get(key)
    if (cached) return cached

    if (key === 'local') {
      this.instances.set(key, localStorageDriver)
      return localStorageDriver
    }
    if (key === 'legacyPublic') {
      this.instances.set(key, legacyPublicStorageDriver)
      return legacyPublicStorageDriver
    }

    const custom = this.custom.get(key)
    if (custom) {
      const driver = custom()
      this.instances.set(key, driver)
      return driver
    }

    const definition = this.definitions.get(key)
    if (definition) {
      const config = readStorageDriverConfigFromEnv(key, this.env)
      const driver = definition.create(config)
      this.instances.set(key, driver)
      return driver
    }

    console.warn(`[attachments.storage] Unknown storage driver "${key}", falling back to local`)
    // Do not cache the fallback under the unknown key — a provider may register later via di.
    return localStorageDriver
  }

  resolveDefault(tenantId?: string | null): StorageDriver {
    return this.resolve(resolveTenantStorageDriverKey(tenantId, this.env))
  }

  listRegisteredKeys(): string[] {
    this.ensureProvidersLoaded()
    return Array.from(
      new Set(['local', 'legacyPublic', ...this.definitions.keys(), ...this.custom.keys()]),
    ).sort()
  }
}

let sharedFactory: StorageDriverFactory | null = null

export function getStorageDriverFactory(): StorageDriverFactory {
  if (!sharedFactory) {
    sharedFactory = new StorageDriverFactory()
    sharedFactory.ensureProvidersLoaded()
  }
  return sharedFactory
}

/** @internal test helper */
export function resetStorageDriverFactoryForTests(): void {
  sharedFactory = null
}
