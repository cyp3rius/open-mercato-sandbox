import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  RemoteCrmClient,
  resolveRemoteCrmConfigFromEnv,
  type RemoteCrmClient as RemoteCrmClientType,
} from '../lib/remoteCrmClient'

type ToolDef = {
  name: string
  description: string
  inputSchema: z.ZodType
  handler: (input: unknown, client: RemoteCrmClientType) => Promise<unknown>
}

function firstItem(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') return null
  const items = (payload as { items?: unknown }).items
  if (!Array.isArray(items) || items.length === 0) return null
  const first = items[0]
  return first && typeof first === 'object' ? (first as Record<string, unknown>) : null
}

const tools: ToolDef[] = [
  {
    name: 'playbooks_whoami',
    description:
      'Show remote CRM connection settings used by this MCP (base URL and whether organization override is set). Does not print the API key.',
    inputSchema: z.object({}),
    handler: async (_input, client) => ({
      ok: true,
      baseUrl: client.config.baseUrl,
      organizationId: client.config.organizationId ?? null,
      hasApiKey: Boolean(client.config.apiKey),
    }),
  },
  {
    name: 'playbooks_compile_markdown',
    description: `Compile a procedure Markdown document on the remote CRM (dry-run).
Validates frontmatter + ## Procedure DSL and returns slug, stepCount, and compiled payload summary.
Does not write to the database.`,
    inputSchema: z.object({
      markdown: z.string().min(1).describe('Full procedure Markdown including YAML frontmatter and ## Procedure'),
    }),
    handler: async (input, client) => {
      const { markdown } = input as { markdown: string }
      return client.compileMarkdown(markdown)
    },
  },
  {
    name: 'playbooks_apply_markdown',
    description: `Import procedure Markdown on the remote CRM by slug (alias of playbooks_import_markdown).
Creates or updates when content changed. Prefer markdown or documents (batch). Set dryRun=true to validate only.`,
    inputSchema: z
      .object({
        markdown: z.string().min(1).optional(),
        documents: z.array(z.string().min(1)).min(1).max(50).optional(),
        dryRun: z.boolean().optional().default(false),
      })
      .refine((value) => Boolean(value.markdown?.trim()) || (value.documents?.length ?? 0) > 0, {
        message: 'markdown or documents required',
      }),
    handler: async (input, client) => {
      const { markdown, documents, dryRun } = input as {
        markdown?: string
        documents?: string[]
        dryRun?: boolean
      }
      if (documents?.length) return client.applyMarkdownBatch(documents, dryRun === true)
      return client.applyMarkdown(markdown!, dryRun === true)
    },
  },
  {
    name: 'playbooks_import_markdown',
    description: `Import (upsert) procedure Markdown on the remote CRM by slug.
Prefer markdown for one doc, or documents for batch. Same slug → new version when content changed.`,
    inputSchema: z
      .object({
        markdown: z.string().min(1).optional(),
        documents: z.array(z.string().min(1)).min(1).max(50).optional(),
        dryRun: z.boolean().optional().default(false),
      })
      .refine((value) => Boolean(value.markdown?.trim()) || (value.documents?.length ?? 0) > 0, {
        message: 'markdown or documents required',
      }),
    handler: async (input, client) => {
      const { markdown, documents, dryRun } = input as {
        markdown?: string
        documents?: string[]
        dryRun?: boolean
      }
      if (documents?.length) return client.applyMarkdownBatch(documents, dryRun === true)
      return client.applyMarkdown(markdown!, dryRun === true)
    },
  },
  {
    name: 'playbooks_export_markdown',
    description:
      'Export active playbook(s) from the remote CRM to procedure Markdown (local step ids only; no database blockId).',
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
    handler: async (input, client) => {
      const { slug, id, ids, slugs } = input as {
        slug?: string
        id?: string
        ids?: string[]
        slugs?: string[]
      }
      if ((ids?.length ?? 0) > 0 || (slugs?.length ?? 0) > 0) {
        return client.exportMarkdownBatch({ ids, slugs })
      }
      if (!slug && !id) throw new Error('Provide slug or id')
      return client.exportMarkdown({ slug, id })
    },
  },
  {
    name: 'playbooks_list',
    description: 'List active playbooks on the remote CRM (id, slug, title, version, tags).',
    inputSchema: z.object({
      search: z.string().optional().describe('Optional title search term'),
      limit: z.number().int().min(1).max(100).optional().default(50),
    }),
    handler: async (input, client) => {
      const { search, limit } = input as { search?: string; limit?: number }
      return client.listPlaybooks({ search, pageSize: limit ?? 50 })
    },
  },
  {
    name: 'playbooks_get',
    description: 'Get one active playbook from the remote CRM by slug or id.',
    inputSchema: z.object({
      slug: z.string().optional(),
      id: z.string().uuid().optional(),
    }),
    handler: async (input, client) => {
      const { slug, id } = input as { slug?: string; id?: string }
      if (!slug && !id) throw new Error('Provide slug or id')
      const payload = id
        ? await client.getPlaybookById(id)
        : await client.getPlaybookBySlug(slug!.trim().toLowerCase())
      const playbook = firstItem(payload)
      if (!playbook) return { ok: false, error: 'not_found' }
      return { ok: true, playbook }
    },
  },
]

export async function runRemotePlaybooksMcpServer(options?: {
  client?: RemoteCrmClientType
  debug?: boolean
}): Promise<void> {
  const client = options?.client ?? new RemoteCrmClient(resolveRemoteCrmConfigFromEnv())
  const debug = options?.debug === true

  const server = new Server(
    { name: 'open-mercato-remote-playbooks', version: '0.1.0' },
    { capabilities: { tools: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: zodToJsonSchema(tool.inputSchema as any) as Record<string, unknown>,
    })),
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name
    const args = request.params.arguments ?? {}
    const tool = tools.find((entry) => entry.name === name)
    if (!tool) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
        isError: true,
      }
    }

    try {
      const parsed = tool.inputSchema.parse(args)
      if (debug) {
        console.error(`[remote-playbooks-mcp] ${name}`, JSON.stringify(parsed).slice(0, 500))
      }
      const result = await tool.handler(parsed, client)
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const body = err && typeof err === 'object' && 'body' in err ? (err as { body: unknown }).body : undefined
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: message, body }, null, 2),
          },
        ],
        isError: true,
      }
    }
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(
    `[remote-playbooks-mcp] Connected to ${client.config.baseUrl}` +
      (client.config.organizationId ? ` (org ${client.config.organizationId})` : ''),
  )
}
