import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { findOneWithDecryption, findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { hasFeature } from '@open-mercato/shared/security/features'
import { CustomerEntity } from './data/entities'

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

function summarizeEntity(row: CustomerEntity) {
  return {
    id: row.id,
    kind: row.kind,
    displayName: row.displayName,
    primaryEmail: row.primaryEmail ?? null,
    primaryPhone: row.primaryPhone ?? null,
    status: row.status ?? null,
    crmRecordType: row.crmRecordType,
    updatedAt: row.updatedAt?.toISOString?.() ?? null,
  }
}

const findTool: AiToolDefinition = {
  name: 'customers_find',
  description: `Search customer people and/or companies by free-text query (display name, email, phone).
Prefer this before inventing customer UUIDs. kind: people | companies | any.`,
  inputSchema: z.object({
    query: z.string().min(1).describe('Search text'),
    kind: z.enum(['people', 'companies', 'any']).optional().default('any'),
    limit: z.number().int().min(1).max(50).optional().default(20),
  }),
  // Feature gating is kind-dependent (people and/or companies) — enforced in handler.
  requiredFeatures: [],
  handler: async (input, ctx) => {
    const { query, kind, limit } = input as {
      query: string
      kind?: 'people' | 'companies' | 'any'
      limit?: number
    }
    const { tenantId, organizationId } = requireScope(ctx)
    const canPeople = ctx.isSuperAdmin || hasFeature(ctx.userFeatures, 'customers.people.view')
    const canCompanies = ctx.isSuperAdmin || hasFeature(ctx.userFeatures, 'customers.companies.view')

    const requested = kind ?? 'any'
    const kinds: Array<'person' | 'company'> = []
    if (requested === 'people' || requested === 'any') {
      if (!canPeople) {
        if (requested === 'people') throw new Error('Missing feature customers.people.view')
      } else {
        kinds.push('person')
      }
    }
    if (requested === 'companies' || requested === 'any') {
      if (!canCompanies) {
        if (requested === 'companies') throw new Error('Missing feature customers.companies.view')
      } else {
        kinds.push('company')
      }
    }
    if (kinds.length === 0) throw new Error('No customer kinds available for current features')

    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const q = query.trim()
    const like = `%${q}%`

    const rows = await findWithDecryption(
      em,
      CustomerEntity,
      {
        tenantId,
        organizationId,
        deletedAt: null,
        kind: { $in: kinds },
        $or: [
          { displayName: { $ilike: like } },
          { primaryEmail: { $ilike: like } },
          { primaryPhone: { $ilike: like } },
        ],
      },
      { orderBy: { updatedAt: 'desc' }, limit: limit ?? 20 },
    )

    return {
      ok: true,
      count: rows.length,
      items: rows.map(summarizeEntity),
    }
  },
}

const getTool: AiToolDefinition = {
  name: 'customers_get',
  description: 'Get one customer person or company by id.',
  inputSchema: z.object({
    id: z.string().uuid(),
    kind: z.enum(['person', 'company']).optional().describe('Optional kind check; omit to allow either'),
  }),
  // Feature gating depends on entity kind — enforced in handler.
  requiredFeatures: [],
  handler: async (input, ctx) => {
    const { id, kind } = input as { id: string; kind?: 'person' | 'company' }
    const { tenantId, organizationId } = requireScope(ctx)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, CustomerEntity, {
      id,
      tenantId,
      organizationId,
      deletedAt: null,
      ...(kind ? { kind } : {}),
    })
    if (!row) return { ok: false, error: 'not_found' }
    if (row.kind === 'person') {
      if (!(ctx.isSuperAdmin || hasFeature(ctx.userFeatures, 'customers.people.view'))) {
        return { ok: false, error: 'forbidden' }
      }
    } else if (row.kind === 'company') {
      if (!(ctx.isSuperAdmin || hasFeature(ctx.userFeatures, 'customers.companies.view'))) {
        return { ok: false, error: 'forbidden' }
      }
    }
    return { ok: true, customer: summarizeEntity(row) }
  },
}

const ensurePersonTool: AiToolDefinition = {
  name: 'customers_ensure_person',
  description: `Find a person by email (preferred) or create one.
Idempotent happy-path: returns existing when primaryEmail matches. Requires firstName + lastName to create.`,
  inputSchema: z.object({
    email: z.string().email().optional(),
    firstName: z.string().min(1).max(120),
    lastName: z.string().min(1).max(120),
    displayName: z.string().min(1).max(200).optional(),
    primaryPhone: z.string().max(50).optional(),
  }),
  requiredFeatures: ['customers.people.view', 'customers.people.manage'],
  handler: async (input, ctx) => {
    const parsed = input as {
      email?: string
      firstName: string
      lastName: string
      displayName?: string
      primaryPhone?: string
    }
    const { tenantId, organizationId } = requireScope(ctx)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const email = parsed.email?.trim().toLowerCase()
    if (email) {
      const existing = await findOneWithDecryption(em, CustomerEntity, {
        tenantId,
        organizationId,
        deletedAt: null,
        kind: 'person',
        primaryEmail: email,
      })
      if (existing) {
        return { ok: true, action: 'found', customer: summarizeEntity(existing) }
      }
    }
    const displayName =
      parsed.displayName?.trim() ||
      `${parsed.firstName.trim()} ${parsed.lastName.trim()}`.trim()
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute('customers.people.create', {
      input: {
        tenantId,
        organizationId,
        firstName: parsed.firstName.trim(),
        lastName: parsed.lastName.trim(),
        displayName,
        primaryEmail: email ?? undefined,
        primaryPhone: parsed.primaryPhone,
      },
      ctx: buildCommandCtx(ctx, tenantId, organizationId),
    })
    const entityId =
      (result as { entityId?: string; id?: string } | undefined)?.entityId ??
      (result as { id?: string } | undefined)?.id ??
      null
    return {
      ok: true,
      action: 'created',
      customerId: entityId,
    }
  },
}

const ensureCompanyTool: AiToolDefinition = {
  name: 'customers_ensure_company',
  description: `Find a company by displayName (case-insensitive) or optional NIP, or create one.
Idempotent when an exact displayName match exists in the org.`,
  inputSchema: z.object({
    displayName: z.string().min(1).max(200),
    primaryEmail: z.string().email().optional(),
    primaryPhone: z.string().max(50).optional(),
    nip: z.string().max(20).optional(),
  }),
  requiredFeatures: ['customers.companies.view', 'customers.companies.manage'],
  handler: async (input, ctx) => {
    const parsed = input as {
      displayName: string
      primaryEmail?: string
      primaryPhone?: string
      nip?: string
    }
    const { tenantId, organizationId } = requireScope(ctx)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const name = parsed.displayName.trim()
    const existingList = await findWithDecryption(
      em,
      CustomerEntity,
      {
        tenantId,
        organizationId,
        deletedAt: null,
        kind: 'company',
        displayName: { $ilike: name },
      },
      { limit: 5 },
    )
    const exact = existingList.find((row) => row.displayName.trim().toLowerCase() === name.toLowerCase())
    if (exact) {
      return { ok: true, action: 'found', customer: summarizeEntity(exact) }
    }
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute('customers.companies.create', {
      input: {
        tenantId,
        organizationId,
        displayName: name,
        primaryEmail: parsed.primaryEmail?.trim().toLowerCase(),
        primaryPhone: parsed.primaryPhone,
        nip: parsed.nip,
      },
      ctx: buildCommandCtx(ctx, tenantId, organizationId),
    })
    const entityId =
      (result as { entityId?: string; id?: string } | undefined)?.entityId ??
      (result as { id?: string } | undefined)?.id ??
      null
    return {
      ok: true,
      action: 'created',
      customerId: entityId,
    }
  },
}

export const aiTools: AiToolDefinition[] = [findTool, getTool, ensurePersonTool, ensureCompanyTool]

export default aiTools
