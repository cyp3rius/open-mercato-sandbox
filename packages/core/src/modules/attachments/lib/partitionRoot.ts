import path from 'path'
import { resolvePartitionEnvKey } from './partitionEnv'

export function resolvePartitionRoot(code: string): string {
  const envKey = resolvePartitionEnvKey(code)
  const envPath = process.env[envKey]
  if (envPath && envPath.trim().length > 0) {
    return path.resolve(envPath)
  }
  return path.join(process.cwd(), 'storage', 'attachments', code)
}
