import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { ensureOrganizationScope } from '@open-mercato/shared/lib/commands/scope'
import { extractUndoPayload } from '@open-mercato/shared/lib/commands/undo'

export function ensureTenantScope(ctx: CommandRuntimeContext, tenantId: string): void {
  const currentTenant = ctx.auth?.tenantId ?? null
  if (currentTenant && currentTenant !== tenantId) {
    throw new CrudHttpError(403, { error: 'Forbidden' })
  }
}

export function numericToString(value: number | null | undefined, fallback = '0'): string {
  if (value == null || !Number.isFinite(value)) return fallback
  return String(value)
}

export { ensureOrganizationScope, extractUndoPayload }
