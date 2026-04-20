import type { CrudCtx } from '@open-mercato/shared/lib/crud/factory'

export function mergeProcurementCommandScope(parsed: Record<string, unknown>, ctx: CrudCtx): Record<string, unknown> {
  const body = { ...parsed }
  if (typeof body.organizationId !== 'string' || body.organizationId.length === 0) {
    const org = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
    if (org) body.organizationId = org
  }
  if (typeof body.tenantId !== 'string' || body.tenantId.length === 0) {
    const tenant = ctx.auth?.tenantId ?? null
    if (tenant) body.tenantId = tenant
  }
  return body
}
