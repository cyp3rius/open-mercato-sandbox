import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { Playbook } from './data/entities'
import { applyPlaybookMarkdown } from './lib/applyPlaybookMarkdown'
import { compileProcedureDocument } from './lib/procedureMarkdown'
import { exportProcedureDocument } from './lib/procedureMarkdownExport'

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

const compileTool: AiToolDefinition = {
  name: 'playbooks_compile_markdown',
  description: `Compile a procedure Markdown document into a playbook upsert payload (frontmatter + ## Procedure DSL).
Does not write to the database. Use before import to review structure with the client.
Returns slug, title, body, contextTags, and procedureDefinition blocks.`,
  inputSchema: z.object({
    markdown: z.string().min(1).describe('Full procedure Markdown including YAML frontmatter and ## Procedure'),
  }),
  requiredFeatures: ['playbooks.view'],
  handler: async (input) => {
    const { markdown } = input as { markdown: string }
    const payload = compileProcedureDocument(markdown)
    return {
      ok: true,
      slug: payload.slug,
      title: payload.title,
      audience: payload.audience,
      contextTags: payload.contextTags,
      stepCount: payload.procedureDefinition.length,
      procedureDefinition: payload.procedureDefinition,
      bodyPreview: payload.body.slice(0, 500),
    }
  },
}

async function importMarkdownHandler(input: unknown, ctx: ToolContext) {
  const parsed = input as { markdown?: string; documents?: string[]; dryRun?: boolean }
  const documents =
    Array.isArray(parsed.documents) && parsed.documents.length > 0
      ? parsed.documents
      : parsed.markdown
        ? [parsed.markdown]
        : []
  if (documents.length === 0) throw new Error('Provide markdown or documents')
  const { tenantId, organizationId } = requireScope(ctx)
  const dryRun = parsed.dryRun === true
  if (documents.length === 1) {
    const markdown = documents[0]!
    if (dryRun) {
      const payload = compileProcedureDocument(markdown)
      return {
        ok: true,
        action: 'compiled',
        slug: payload.slug,
        playbookId: null,
        stepCount: payload.procedureDefinition.length,
      }
    }
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const em = ctx.container.resolve('em') as EntityManager
    const result = await applyPlaybookMarkdown({
      markdown,
      tenantId,
      organizationId,
      commandBus,
      ctx: buildCommandCtx(ctx, tenantId, organizationId),
      em: em.fork(),
    })
    return {
      ok: true,
      action: result.action,
      slug: result.slug,
      playbookId: result.playbookId,
      stepCount: result.payload.procedureDefinition.length,
    }
  }

  const commandBus = ctx.container.resolve('commandBus') as CommandBus
  const em = ctx.container.resolve('em') as EntityManager
  const results = []
  for (const markdown of documents) {
    try {
      if (dryRun) {
        const payload = compileProcedureDocument(markdown)
        results.push({
          ok: true,
          action: 'compiled' as const,
          slug: payload.slug,
          playbookId: null,
          stepCount: payload.procedureDefinition.length,
        })
        continue
      }
      const result = await applyPlaybookMarkdown({
        markdown,
        tenantId,
        organizationId,
        commandBus,
        ctx: buildCommandCtx(ctx, tenantId, organizationId),
        em: em.fork(),
      })
      results.push({
        ok: true,
        action: result.action,
        slug: result.slug,
        playbookId: result.playbookId,
        stepCount: result.payload.procedureDefinition.length,
      })
    } catch (err) {
      results.push({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  const failed = results.filter((item) => !item.ok).length
  return {
    ok: failed === 0,
    results,
    summary: { total: results.length, succeeded: results.length - failed, failed },
  }
}

const importInputSchema = z
  .object({
    markdown: z
      .string()
      .min(1)
      .optional()
      .describe('Full procedure Markdown including YAML frontmatter and ## Procedure'),
    documents: z
      .array(z.string().min(1))
      .min(1)
      .max(50)
      .optional()
      .describe('Batch of procedure Markdown documents (same slug → new version on content change)'),
    dryRun: z.boolean().optional().default(false).describe('If true, compile only — no database write'),
  })
  .refine((value) => Boolean(value.markdown?.trim()) || (value.documents?.length ?? 0) > 0, {
    message: 'markdown or documents required',
  })

const importTool: AiToolDefinition = {
  name: 'playbooks_import_markdown',
  description: `Import (upsert) procedure Markdown into the current tenant/org by slug.
Creates or updates a version when content changed. Prefer markdown for one doc, or documents for batch.
Set dryRun=true to validate only.`,
  inputSchema: importInputSchema,
  requiredFeatures: ['playbooks.create', 'playbooks.edit'],
  handler: importMarkdownHandler,
}

const applyTool: AiToolDefinition = {
  name: 'playbooks_apply_markdown',
  description: `Import procedure Markdown (alias of playbooks_import_markdown). Upsert by slug; dryRun validates only.`,
  inputSchema: importInputSchema,
  requiredFeatures: ['playbooks.create', 'playbooks.edit'],
  handler: importMarkdownHandler,
}

const exportTool: AiToolDefinition = {
  name: 'playbooks_export_markdown',
  description: `Export active playbook(s) to procedure Markdown (frontmatter + ## Procedure; local step ids only — no database blockId).
Provide slug, id, ids, or slugs.`,
  inputSchema: z
    .object({
      slug: z.string().optional(),
      id: z.string().uuid().optional(),
      ids: z.array(z.string().uuid()).min(1).max(100).optional(),
      slugs: z.array(z.string().min(1)).min(1).max(100).optional(),
    })
    .refine(
      (value) =>
        Boolean(value.slug || value.id) || (value.ids?.length ?? 0) > 0 || (value.slugs?.length ?? 0) > 0,
      { message: 'slug, id, ids, or slugs required' },
    ),
  requiredFeatures: ['playbooks.view'],
  handler: async (input, ctx) => {
    const { slug, id, ids, slugs } = input as {
      slug?: string
      id?: string
      ids?: string[]
      slugs?: string[]
    }
    const { tenantId, organizationId } = requireScope(ctx)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const batch = (ids?.length ?? 0) > 0 || (slugs?.length ?? 0) > 0
    if (batch) {
      const orFilters: Array<Record<string, unknown>> = []
      if (ids?.length) orFilters.push({ id: { $in: ids } })
      if (slugs?.length) orFilters.push({ slug: { $in: slugs.map((s) => s.trim().toLowerCase()) } })
      const rows = await em.find(
        Playbook,
        {
          tenantId,
          organizationId,
          deletedAt: null,
          isActive: true,
          $or: orFilters,
        },
        { orderBy: { slug: 'asc' } },
      )
      return {
        ok: true,
        items: rows.map((row) => ({
          id: row.id,
          slug: row.slug,
          title: row.title,
          version: row.version,
          markdown: exportProcedureDocument({
            slug: row.slug,
            title: row.title,
            body: row.body,
            audience: row.audience as 'internal' | 'customer_facing' | 'both' | null | undefined,
            contextTags: row.contextTags ?? [],
            defaultSlaDuration: row.defaultSlaDuration ?? null,
            recommendedOwnerUserIds: row.recommendedOwnerUserIds ?? [],
            procedureDefinition: row.procedureDefinition ?? [],
          }),
        })),
      }
    }
    if (!slug && !id) throw new Error('Provide slug or id')
    const row = await em.findOne(Playbook, {
      ...(id ? { id } : { slug: slug!.trim().toLowerCase() }),
      tenantId,
      organizationId,
      deletedAt: null,
      isActive: true,
    })
    if (!row) return { ok: false, error: 'not_found' }
    const markdown = exportProcedureDocument({
      slug: row.slug,
      title: row.title,
      body: row.body,
      audience: row.audience as 'internal' | 'customer_facing' | 'both' | null | undefined,
      contextTags: row.contextTags ?? [],
      defaultSlaDuration: row.defaultSlaDuration ?? null,
      recommendedOwnerUserIds: row.recommendedOwnerUserIds ?? [],
      procedureDefinition: row.procedureDefinition ?? [],
    })
    return {
      ok: true,
      id: row.id,
      slug: row.slug,
      title: row.title,
      version: row.version,
      markdown,
    }
  },
}

const listTool: AiToolDefinition = {
  name: 'playbooks_list',
  description: 'List active playbooks in the current organization (id, slug, title, version, tags).',
  inputSchema: z.object({
    search: z.string().optional().describe('Optional title/slug search term'),
    limit: z.number().int().min(1).max(100).optional().default(50),
  }),
  requiredFeatures: ['playbooks.view'],
  handler: async (input, ctx) => {
    const { search, limit } = input as { search?: string; limit?: number }
    const { tenantId, organizationId } = requireScope(ctx)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const where: Record<string, unknown> = {
      tenantId,
      organizationId,
      deletedAt: null,
      isActive: true,
    }
    const items = await em.find(Playbook, where, {
      orderBy: { updatedAt: 'desc' },
      limit: limit ?? 50,
    })
    const filtered = search?.trim()
      ? items.filter((row) => {
          const q = search.trim().toLowerCase()
          return row.slug.includes(q) || row.title.toLowerCase().includes(q)
        })
      : items
    return {
      ok: true,
      items: filtered.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        version: row.version,
        audience: row.audience,
        contextTags: row.contextTags ?? [],
        stepCount: Array.isArray(row.procedureDefinition) ? row.procedureDefinition.length : 0,
      })),
    }
  },
}

const getTool: AiToolDefinition = {
  name: 'playbooks_get',
  description: 'Get one active playbook by slug or id, including procedureDefinition.',
  inputSchema: z.object({
    slug: z.string().optional(),
    id: z.string().uuid().optional(),
  }),
  requiredFeatures: ['playbooks.view'],
  handler: async (input, ctx) => {
    const { slug, id } = input as { slug?: string; id?: string }
    if (!slug && !id) throw new Error('Provide slug or id')
    const { tenantId, organizationId } = requireScope(ctx)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await em.findOne(Playbook, {
      ...(id ? { id } : { slug: slug!.trim().toLowerCase() }),
      tenantId,
      organizationId,
      deletedAt: null,
      isActive: true,
    })
    if (!row) return { ok: false, error: 'not_found' }
    return {
      ok: true,
      playbook: {
        id: row.id,
        slug: row.slug,
        title: row.title,
        body: row.body,
        audience: row.audience,
        contextTags: row.contextTags ?? [],
        defaultSlaDuration: row.defaultSlaDuration ?? null,
        version: row.version,
        procedureDefinition: row.procedureDefinition ?? [],
      },
    }
  },
}

export const aiTools: AiToolDefinition[] = [
  compileTool,
  importTool,
  applyTool,
  exportTool,
  listTool,
  getTool,
]

export default aiTools
