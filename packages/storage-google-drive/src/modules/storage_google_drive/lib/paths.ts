import { randomUUID } from 'crypto'

export function sanitizeFileName(fileName: string): string {
  if (!fileName) return 'file'
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export function resolveOrgSegment(orgId: string | null | undefined): string {
  if (typeof orgId === 'string' && orgId.trim().length > 0) return `org_${orgId}`
  return 'org_shared'
}

export function resolveTenantSegment(tenantId: string | null | undefined): string {
  if (typeof tenantId === 'string' && tenantId.trim().length > 0) return `tenant_${tenantId}`
  return 'tenant_shared'
}

export function sanitizeStorageRelativePath(storagePath: string): string {
  let safeRelative = storagePath.replace(/^\/*/, '')
  do {
    const prev = safeRelative
    safeRelative = safeRelative.replace(/\.\.(\/|\\)/g, '')
    if (safeRelative === prev) break
  } while (true)
  return safeRelative
}

/**
 * Open Mercato local layout (under partition root):
 *   org_{id}|org_shared / tenant_{id}|tenant_shared / {timestamp}_{uuid}_{name}
 *
 * Google Drive layout (under ROOT_FOLDER_ID):
 *   {partitionCode} / org_… / tenant_… / {timestamp}_{uuid}_{name}
 *
 * `storagePath` stored in DB stays partition-relative (same as local):
 *   org_…/tenant_…/{file}
 */
export function buildStoredFileName(fileName: string, now = Date.now()): string {
  const safeName = sanitizeFileName(fileName || 'file')
  const uniqueSuffix = randomUUID().replace(/-/g, '').slice(0, 12)
  return `${now}_${uniqueSuffix}_${safeName}`
}

export function buildRelativeStoragePath(input: {
  orgId: string | null | undefined
  tenantId: string | null | undefined
  storedName: string
}): string {
  const orgSegment = resolveOrgSegment(input.orgId)
  const tenantSegment = resolveTenantSegment(input.tenantId)
  return `${orgSegment}/${tenantSegment}/${input.storedName}`
}

export function resolveDriveFolderSegments(partitionCode: string, storagePath: string): {
  folderSegments: string[]
  fileName: string
} {
  const safe = sanitizeStorageRelativePath(storagePath)
  const parts = safe.split('/').filter(Boolean)
  if (parts.length < 1) {
    throw new Error(`Invalid storage path: ${storagePath}`)
  }
  const fileName = parts[parts.length - 1]!
  const relativeFolders = parts.slice(0, -1)
  return {
    folderSegments: [partitionCode, ...relativeFolders],
    fileName,
  }
}

export function resolveUploadFolderSegments(input: {
  partitionCode: string
  orgId: string | null | undefined
  tenantId: string | null | undefined
}): string[] {
  return [input.partitionCode, resolveOrgSegment(input.orgId), resolveTenantSegment(input.tenantId)]
}
