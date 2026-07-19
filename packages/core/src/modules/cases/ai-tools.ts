import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { findOneWithDecryption, findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { ServiceCase } from './data/entities'
import { Playbook } from '../playbooks/data/entities'

type ToolContext = {
  tenantId: string | null
  organizationId: string | null
  userId: string | null
  container: {
    resolve: <T = unknown>(name: string) => T
  }
  userFeatures: string[]
  isSuperAdmin: boolean
}

type AiToolDefinition = {
  name: string
  description: string
  inputSchema: z.ZodType
  requiredFeatures?: string[]
  handler: (input: unknown, ctx: ToolContext) => Promise<unknown>
}

function requireScope(ctx: ToolContext): { tenantId: string; organizationId: string } {
  if (!ctx.tenantId || !ctx.organizationId) {
    throw new Error('Tenant and organization context are required. Call context_whoami first.')
  }
  return { tenantId: ctx.tenantId, organizationId: ctx.organizationId }
}

function buildCommandCtx(ctx: ToolContext, tenantId: string, organizationId: string): CommandRuntimeContext {
  return {
    container: ctx.container as CommandRuntimeContext['container'],
    auth: {
      sub: ctx.userId ?? 'mcp',
      tenantId,
      orgId: organizationId,
    } as CommandRuntimeContext['auth'],
    organizationScope: null,
    selectedOrganizationId: organizationId,
    organizationIds: [organizationId],
    request: undefined as unknown as CommandRuntimeContext['request'],
  }
}

function summarizeCase(row: ServiceCase) {
  return {
    id: row.id,
    title: row.title,
    statusValue: row.statusValue,
    statusLabel: row.statusLabel ?? null,
    customerEntityId: row.customerEntityId,
    ownerUserId: row.ownerUserId ?? null,
    priority: row.priority,
    openedAt: row.openedAt?.toISOString?.() ?? row.openedAt ?? null,
    closedAt: row.closedAt?.toISOString?.() ?? row.closedAt ?? null,
    updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt ?? null,
  }
}

const findTool: AiToolDefinition = {
  name: 'cases_find',
  description: `Find service cases in the current organization.
Optional search (title), statusValue, customerEntityId, ownerUserId.
Prefer this before inventing case UUIDs. Returns id, title, status, customer/owner refs.`,
  inputSchema: z.object({
    search: z.string().optional().describe('Case title search'),
    statusValue: z.string().optional().describe('Exact status_value filter (e.g. open)'),
    customerEntityId: z.string().uuid().optional(),
    ownerUserId: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(100).optional().default(25),
  }),
  requiredFeatures: ['cases.view'],
  handler: async (input, ctx) => {
    const { search, statusValue, customerEntityId, ownerUserId, limit } = input as {
      search?: string
      statusValue?: string
      customerEntityId?: string
      ownerUserId?: string
      limit?: number
    }
    const { tenantId, organizationId } = requireScope(ctx)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const where: Record<string, unknown> = {
      tenantId,
      organizationId,
      deletedAt: null,
    }
    if (statusValue?.trim()) where.statusValue = statusValue.trim()
    if (customerEntityId) where.customerEntityId = customerEntityId
    if (ownerUserId) where.ownerUserId = ownerUserId
    if (search?.trim()) {
      where.title = { $ilike: `%${search.trim()}%` }
    }
    const rows = await findWithDecryption(
      em,
      ServiceCase,
      where,
      { orderBy: { updatedAt: 'desc' }, limit: limit ?? 25 },
    )
    return {
      ok: true,
      count: rows.length,
      items: rows.map(summarizeCase),
    }
  },
}

const getTool: AiToolDefinition = {
  name: 'cases_get',
  description: 'Get one service case by id in the current organization.',
  inputSchema: z.object({
    id: z.string().uuid(),
  }),
  requiredFeatures: ['cases.view'],
  handler: async (input, ctx) => {
    const { id } = input as { id: string }
    const { tenantId, organizationId } = requireScope(ctx)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, ServiceCase, {
      id,
      tenantId,
      organizationId,
      deletedAt: null,
    })
    if (!row) return { ok: false, error: 'not_found' }
    return { ok: true, case: summarizeCase(row) }
  },
}

const createWithPlaybookTool: AiToolDefinition = {
  name: 'cases_create_with_playbook',
  description: `Create a case linked to a playbook (procedure template) without starting the procedure.
Provide playbookId or playbookSlug. ownerUserId is required. Prefer customers_find / customers_ensure_* for customerEntityId.`,
  inputSchema: z.object({
    title: z.string().min(1).max(500),
    customerEntityId: z.string().uuid(),
    ownerUserId: z.string().uuid(),
    playbookId: z.string().uuid().optional(),
    playbookSlug: z.string().min(1).optional(),
    statusValue: z.string().optional().default('open'),
    priority: z.string().optional().default('normal'),
    resourceId: z.string().uuid().optional().nullable(),
  }),
  requiredFeatures: ['cases.create'],
  handler: async (input, ctx) => {
    const parsed = input as {
      title: string
      customerEntityId: string
      ownerUserId: string
      playbookId?: string
      playbookSlug?: string
      statusValue?: string
      priority?: string
      resourceId?: string | null
    }
    if (!parsed.playbookId && !parsed.playbookSlug?.trim()) {
      throw new Error('Provide playbookId or playbookSlug')
    }
    const { tenantId, organizationId } = requireScope(ctx)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    let playbookId = parsed.playbookId ?? null
    if (!playbookId && parsed.playbookSlug) {
      const pb = await em.findOne(Playbook, {
        slug: parsed.playbookSlug.trim().toLowerCase(),
        tenantId,
        organizationId,
        deletedAt: null,
        isActive: true,
      })
      if (!pb) return { ok: false, error: 'playbook_not_found', slug: parsed.playbookSlug }
      playbookId = pb.id
    }
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute('cases.cases.create', {
      input: {
        tenantId,
        organizationId,
        title: parsed.title.trim(),
        customerEntityId: parsed.customerEntityId,
        ownerUserId: parsed.ownerUserId,
        playbookId,
        statusValue: parsed.statusValue ?? 'open',
        priority: parsed.priority ?? 'normal',
        resourceId: parsed.resourceId ?? null,
      },
      ctx: buildCommandCtx(ctx, tenantId, organizationId),
    })
    const caseId = (result as { caseId?: string } | undefined)?.caseId
    return {
      ok: true,
      caseId: caseId ?? null,
      playbookId,
    }
  },
}

const transitionTool: AiToolDefinition = {
  name: 'cases_transition_stage',
  description: `Update a case statusValue (and optional statusLabel/statusColor).
Uses cases.cases.update — only set values your org dictionaries allow. Prefer cases_get first.`,
  inputSchema: z.object({
    id: z.string().uuid(),
    statusValue: z.string().min(1).max(100),
    statusLabel: z.string().max(200).optional().nullable(),
    statusColor: z.string().max(50).optional().nullable(),
    closingNote: z.string().max(10000).optional().nullable(),
  }),
  requiredFeatures: ['cases.edit'],
  handler: async (input, ctx) => {
    const parsed = input as {
      id: string
      statusValue: string
      statusLabel?: string | null
      statusColor?: string | null
      closingNote?: string | null
    }
    const { tenantId, organizationId } = requireScope(ctx)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const existing = await findOneWithDecryption(em, ServiceCase, {
      id: parsed.id,
      tenantId,
      organizationId,
      deletedAt: null,
    })
    if (!existing) return { ok: false, error: 'not_found' }
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute('cases.cases.update', {
      input: {
        id: parsed.id,
        statusValue: parsed.statusValue,
        statusLabel: parsed.statusLabel,
        statusColor: parsed.statusColor,
        closingNote: parsed.closingNote,
        closedAt:
          parsed.statusValue === 'closed' || parsed.statusValue === 'done'
            ? new Date()
            : undefined,
      },
      ctx: buildCommandCtx(ctx, tenantId, organizationId),
    })
    return {
      ok: true,
      caseId: (result as { caseId?: string } | undefined)?.caseId ?? parsed.id,
      statusValue: parsed.statusValue,
    }
  },
}

const assignOwnerTool: AiToolDefinition = {
  name: 'cases_assign_owner',
  description: 'Assign or clear the case ownerUserId (staff user uuid). Prefer directory/user list via Code Mode if you need to resolve users.',
  inputSchema: z.object({
    id: z.string().uuid(),
    ownerUserId: z.string().uuid().nullable(),
  }),
  requiredFeatures: ['cases.edit'],
  handler: async (input, ctx) => {
    const parsed = input as { id: string; ownerUserId: string | null }
    const { tenantId, organizationId } = requireScope(ctx)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const existing = await findOneWithDecryption(em, ServiceCase, {
      id: parsed.id,
      tenantId,
      organizationId,
      deletedAt: null,
    })
    if (!existing) return { ok: false, error: 'not_found' }
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute('cases.cases.update', {
      input: {
        id: parsed.id,
        ownerUserId: parsed.ownerUserId,
      },
      ctx: buildCommandCtx(ctx, tenantId, organizationId),
    })
    return {
      ok: true,
      caseId: (result as { caseId?: string } | undefined)?.caseId ?? parsed.id,
      ownerUserId: parsed.ownerUserId,
    }
  },
}

export const aiTools: AiToolDefinition[] = [
  findTool,
  getTool,
  createWithPlaybookTool,
  transitionTool,
  assignOwnerTool,
]

export default aiTools
