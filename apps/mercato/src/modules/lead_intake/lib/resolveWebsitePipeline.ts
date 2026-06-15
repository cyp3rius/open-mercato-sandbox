import type { EntityManager } from '@mikro-orm/postgresql'
import { CustomerPipeline } from '@open-mercato/core/modules/customers/data/entities'

export const WEBSITE_PIPELINE_NAME = 'website'

export type WebsitePipelineAssignment = {
  pipelineId: string
}

function normalizePipelineName(name: string): string {
  return name.trim().toLowerCase()
}

export function matchPipelineIdByName(
  pipelines: Array<{ id: string; name: string }>,
  targetName: string,
): string | null {
  const normalizedTarget = normalizePipelineName(targetName)
  if (!normalizedTarget.length) return null
  const match = pipelines.find((pipeline) => normalizePipelineName(pipeline.name) === normalizedTarget)
  return match?.id ?? null
}

export async function resolveWebsitePipelineForDeal(
  em: EntityManager,
  params: { organizationId: string; tenantId: string },
): Promise<WebsitePipelineAssignment | null> {
  const pipelines = await em.find(CustomerPipeline, {
    organizationId: params.organizationId,
    tenantId: params.tenantId,
  })
  const pipelineId = matchPipelineIdByName(pipelines, WEBSITE_PIPELINE_NAME)
  return pipelineId ? { pipelineId } : null
}
