import type { EntityManager } from '@mikro-orm/postgresql'
import { ServiceCase } from '@open-mercato/core/modules/cases/data/entities'
import { Playbook } from '@open-mercato/core/modules/playbooks/data/entities'
import { InsurancePolicy } from '../data/entities'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type GuardPlanInsuranceSigningCasePayload = {
  title: string
  customerEntityId: string
  playbookId: string | null
}

type MinimalWorkflowActivityContext = {
  workflowInstance: { tenantId: string; organizationId: string }
  workflowContext: Record<string, unknown>
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

function parseSigningStatusesFromEnv(): string[] {
  const raw = process.env.OM_INSURANCE_POLICY_SIGNING_CASE_STATUSES
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return ['contract_signing']
}

function metadataRecord(meta: unknown): Record<string, unknown> | null {
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    return meta as Record<string, unknown>
  }
  return null
}

function readOptionalUuid(meta: Record<string, unknown> | null, key: string): string | undefined {
  if (!meta) return undefined
  const value = meta[key]
  if (typeof value !== 'string' || !value.trim()) return undefined
  const trimmed = value.trim()
  return isUuid(trimmed) ? trimmed : undefined
}

export function createGuardAndPlanInsuranceSigningCase(em: EntityManager) {
  return async (
    args: { policyId?: string },
    ctx: MinimalWorkflowActivityContext,
  ): Promise<GuardPlanInsuranceSigningCasePayload> => {
    const fork = em.fork()
    const tenantId = ctx.workflowInstance.tenantId
    const organizationId = ctx.workflowInstance.organizationId

    const policyIdRaw =
      typeof args.policyId === 'string' && args.policyId.trim()
        ? args.policyId.trim()
        : typeof ctx.workflowContext.policyId === 'string'
          ? ctx.workflowContext.policyId.trim()
          : typeof ctx.workflowContext.id === 'string'
            ? ctx.workflowContext.id.trim()
            : ''

    if (!policyIdRaw || !isUuid(policyIdRaw)) {
      throw new Error('guardAndPlanInsuranceSigningCase: missing or invalid policyId')
    }

    const policy = await fork.findOne(
      InsurancePolicy,
      { id: policyIdRaw, tenantId, organizationId, deletedAt: null },
      { populate: ['insurer'] },
    )

    if (!policy) {
      throw new Error(`guardAndPlanInsuranceSigningCase: policy ${policyIdRaw} not found`)
    }

    const policyMeta = metadataRecord(policy.metadata)
    const statusesFromMeta = policyMeta?.signingCaseTriggerStatuses
    let allowedStatuses: string[]
    if (Array.isArray(statusesFromMeta)) {
      allowedStatuses = statusesFromMeta
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim())
      if (allowedStatuses.length === 0) {
        allowedStatuses = parseSigningStatusesFromEnv()
      }
    } else {
      allowedStatuses = parseSigningStatusesFromEnv()
    }

    const currentStatus = typeof policy.status === 'string' ? policy.status.trim() : ''
    if (!currentStatus || !allowedStatuses.includes(currentStatus)) {
      throw new Error(
        `guardAndPlanInsuranceSigningCase: policy status "${currentStatus}" is not in allowed signing statuses (${allowedStatuses.join(', ')})`,
      )
    }

    const customerEntityId =
      (policy.insuredPersonEntityId && policy.insuredPersonEntityId.trim()) ||
      (policy.insuredCompanyEntityId && policy.insuredCompanyEntityId.trim()) ||
      ''

    if (!customerEntityId || !isUuid(customerEntityId)) {
      throw new Error(
        'guardAndPlanInsuranceSigningCase: policy has no insuredPersonEntityId or insuredCompanyEntityId',
      )
    }

    const duplicate = await fork.findOne(ServiceCase, {
      insurancePolicyId: policyIdRaw,
      tenantId,
      organizationId,
      deletedAt: null,
    })
    if (duplicate) {
      throw new Error(
        `guardAndPlanInsuranceSigningCase: case ${duplicate.id} already exists for policy ${policyIdRaw}`,
      )
    }

    let playbookId: string | null = readOptionalUuid(policyMeta, 'signingCasePlaybookId') ?? null

    if (!playbookId) {
      const insurer = policy.insurer
      const insurerMeta = metadataRecord(
        insurer && typeof insurer === 'object' && insurer !== null ? insurer.metadata : undefined,
      )
      playbookId = readOptionalUuid(insurerMeta, 'signingCasePlaybookId') ?? null
    }

    if (playbookId) {
      const playbook = await fork.findOne(Playbook, {
        id: playbookId,
        tenantId,
        organizationId,
        deletedAt: null,
      })
      if (!playbook) {
        throw new Error(
          `guardAndPlanInsuranceSigningCase: playbook ${playbookId} not found for tenant/org`,
        )
      }
    }

    const title = `Polisa ${policy.policyNumber} — podpisanie`

    return {
      title,
      customerEntityId,
      playbookId,
    }
  }
}
