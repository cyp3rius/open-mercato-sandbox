import type { EntityManager } from '@mikro-orm/postgresql'
import { ResourcesResourceType } from '@open-mercato/core/modules/resources/data/entities'

export async function resolveEffectiveFleetResourceTypeId(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
  configuredTypeId: string | null | undefined,
): Promise<string | null> {
  const typeId = configuredTypeId?.trim()
  if (!typeId) return null
  const row = await em.findOne(ResourcesResourceType, {
    id: typeId,
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    deletedAt: null,
  })
  return row ? typeId : null
}
