import { createRequire } from 'module'
import { pathToFileURL } from 'url'
import path from 'path'
import type { StorageDriverDefinition } from './types'
import { parseProviderModuleSpecs } from './envConfig'

/** Resolve modules relative to process.cwd() / node_modules (Jest + ESM safe). */
const requireFromCwd = createRequire(path.join(process.cwd(), 'package.json'))

function isStorageDriverDefinition(value: unknown): value is StorageDriverDefinition {
  if (!value || typeof value !== 'object') return false
  const candidate = value as { key?: unknown; create?: unknown }
  return typeof candidate.key === 'string' && candidate.key.trim().length > 0 && typeof candidate.create === 'function'
}

function extractDefinition(moduleExports: unknown, moduleId: string): StorageDriverDefinition {
  if (!moduleExports || typeof moduleExports !== 'object') {
    throw new Error(`[attachments.storage] Provider module "${moduleId}" did not export an object`)
  }
  const exportsRecord = moduleExports as Record<string, unknown>
  const candidates = [exportsRecord.storageDriverDefinition, exportsRecord.default, moduleExports]
  for (const candidate of candidates) {
    if (isStorageDriverDefinition(candidate)) return candidate
    if (candidate && typeof candidate === 'object') {
      const nested = (candidate as { storageDriverDefinition?: unknown }).storageDriverDefinition
      if (isStorageDriverDefinition(nested)) return nested
      const defaultExport = (candidate as { default?: unknown }).default
      if (isStorageDriverDefinition(defaultExport)) return defaultExport
    }
  }
  throw new Error(
    `[attachments.storage] Provider module "${moduleId}" must export storageDriverDefinition ({ key, create })`,
  )
}

function parseModuleSpec(spec: string): { keyOverride: string | null; moduleId: string } {
  const keyModuleMatch = /^([A-Za-z][A-Za-z0-9_-]*)=(.+)$/.exec(spec)
  if (keyModuleMatch) {
    return { keyOverride: keyModuleMatch[1], moduleId: keyModuleMatch[2] }
  }
  return { keyOverride: null, moduleId: spec }
}

function loadModuleExportsSync(moduleId: string): unknown {
  const candidates = moduleId.includes('/storage-driver')
    ? [moduleId]
    : [moduleId, `${moduleId}/storage-driver`]

  const errors: string[] = []
  for (const candidate of candidates) {
    try {
      return requireFromCwd(candidate)
    } catch (error) {
      const absolute = path.isAbsolute(candidate) ? candidate : path.resolve(process.cwd(), candidate)
      try {
        return requireFromCwd(absolute)
      } catch (inner) {
        errors.push(
          `${candidate}: ${inner instanceof Error ? inner.message : String(inner)}`,
        )
      }
      errors.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  throw new Error(
    `[attachments.storage] Failed to load provider module "${moduleId}": ${errors.join(' | ')}`,
  )
}

/**
 * Synchronously load provider definitions listed in ATTACHMENTS_STORAGE_PROVIDER_MODULES.
 * Each module must export `storageDriverDefinition` with `{ key, create(config) }`.
 */
export function loadStorageDriverDefinitionsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Map<string, StorageDriverDefinition> {
  const definitions = new Map<string, StorageDriverDefinition>()
  for (const spec of parseProviderModuleSpecs(env)) {
    const { keyOverride, moduleId } = parseModuleSpec(spec)
    const definition = extractDefinition(loadModuleExportsSync(moduleId), moduleId)
    const key = (keyOverride ?? definition.key).trim()
    if (definitions.has(key)) {
      console.warn(`[attachments.storage] Duplicate provider key "${key}" from "${moduleId}", overriding previous`)
    }
    definitions.set(key, key === definition.key ? definition : { ...definition, key })
  }
  return definitions
}

/** Async loader for ESM-only packages when sync require is insufficient. */
export async function loadStorageDriverDefinitionsFromEnvAsync(
  env: NodeJS.ProcessEnv = process.env,
): Promise<Map<string, StorageDriverDefinition>> {
  const definitions = new Map<string, StorageDriverDefinition>()
  for (const spec of parseProviderModuleSpecs(env)) {
    const { keyOverride, moduleId } = parseModuleSpec(spec)
    let moduleExports: unknown
    try {
      moduleExports = await import(moduleId)
    } catch {
      const absolute = path.isAbsolute(moduleId) ? moduleId : path.resolve(process.cwd(), moduleId)
      moduleExports = await import(pathToFileURL(absolute).href)
    }
    const definition = extractDefinition(moduleExports, moduleId)
    const key = (keyOverride ?? definition.key).trim()
    definitions.set(key, key === definition.key ? definition : { ...definition, key })
  }
  return definitions
}
