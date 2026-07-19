import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { applyPlaybookMarkdown } from '../../lib/applyPlaybookMarkdown'
import { compileProcedureDocument } from '../../lib/procedureMarkdown'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['playbooks.create', 'playbooks.edit'] },
}

export const openApi = {
  tags: ['Playbooks'],
  summary: 'Compile procedure Markdown and upsert playbook by slug (single or batch)',
}

const markdownSchema = z.string().min(1).max(500_000)

const bodySchema = z
  .object({
    markdown: markdownSchema.optional(),
    documents: z.array(markdownSchema).min(1).max(50).optional(),
    dryRun: z.boolean().optional().default(false),
  })
  .refine((value) => Boolean(value.markdown?.trim()) || (value.documents?.length ?? 0) > 0, {
    message: 'markdown or documents required',
  })

type ApplySummary = {
  ok: true
  action: 'created' | 'updated' | 'unchanged' | 'compiled'
  slug: string
  playbookId: string | null
  payload: {
    slug: string
    title: string
    audience: string
    contextTags: string[]
    stepCount: number
  }
}

type ApplyFailure = {
  ok: false
  slug: string | null
  error: string
}

async function buildContext(req: Request): Promise<CommandRuntimeContext> {
  const container = await createRequestContainer()
  const auth = await getAuthFromRequest(req)
  if (!auth) throw new CrudHttpError(401, { error: 'Unauthorized' })
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  return {
    container,
    auth,
    organizationScope: scope,
    selectedOrganizationId: scope?.selectedId ?? auth.orgId ?? null,
    organizationIds: scope?.filterIds ?? (auth.orgId ? [auth.orgId] : null),
    request: req,
  }
}

function summarizeSuccess(
  action: ApplySummary['action'],
  slug: string,
  playbookId: string | null,
  payload: {
    slug: string
    title: string
    audience: string
    contextTags: string[]
    procedureDefinition: unknown[]
  },
): ApplySummary {
  return {
    ok: true,
    action,
    slug,
    playbookId,
    payload: {
      slug: payload.slug,
      title: payload.title,
      audience: payload.audience,
      contextTags: payload.contextTags,
      stepCount: payload.procedureDefinition.length,
    },
  }
}

async function applyOne(params: {
  markdown: string
  dryRun: boolean
  tenantId: string
  organizationId: string
  commandBus: CommandBus
  ctx: CommandRuntimeContext
  em: EntityManager
}): Promise<ApplySummary | ApplyFailure> {
  try {
    if (params.dryRun) {
      const payload = compileProcedureDocument(params.markdown)
      return summarizeSuccess('compiled', payload.slug, null, payload)
    }
    const result = await applyPlaybookMarkdown({
      markdown: params.markdown,
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      dryRun: false,
      commandBus: params.commandBus,
      ctx: params.ctx,
      em: params.em.fork(),
    })
    return summarizeSuccess(result.action, result.slug, result.playbookId, result.payload)
  } catch (err) {
    let slug: string | null = null
    try {
      slug = compileProcedureDocument(params.markdown).slug
    } catch {
      slug = null
    }
    return {
      ok: false,
      slug,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await buildContext(req)
    const tenantId = ctx.auth?.tenantId
    const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId
    if (!tenantId || !organizationId) {
      return NextResponse.json({ error: 'Tenant and organization context are required.' }, { status: 400 })
    }

    const raw = await req.json().catch(() => ({}))
    const parsed = bodySchema.parse(raw)
    const documents =
      parsed.documents && parsed.documents.length > 0
        ? parsed.documents
        : [parsed.markdown!.trim()].filter(Boolean)

    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const em = ctx.container.resolve('em') as EntityManager
    const results: Array<ApplySummary | ApplyFailure> = []
    for (const markdown of documents) {
      results.push(
        await applyOne({
          markdown,
          dryRun: parsed.dryRun,
          tenantId,
          organizationId,
          commandBus,
          ctx,
          em,
        }),
      )
    }

    if (documents.length === 1) {
      const only = results[0]!
      if (!only.ok) {
        return NextResponse.json(
          {
            error: only.error,
            slug: only.slug,
          },
          { status: 400 },
        )
      }
      return NextResponse.json({
        ok: true,
        action: only.action,
        slug: only.slug,
        playbookId: only.playbookId,
        payload: only.payload,
      })
    }

    const failed = results.filter((item) => !item.ok).length
    return NextResponse.json({
      ok: failed === 0,
      results,
      summary: {
        total: results.length,
        succeeded: results.length - failed,
        failed,
      },
    })
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', details: err.flatten() }, { status: 400 })
    }
    const { translate } = await resolveTranslations()
    const message = err instanceof Error ? err.message : String(err)
    console.error('playbooks.from-markdown failed', err)
    return NextResponse.json(
      {
        error: translate('playbooks.fromMarkdown.errors.apply', 'Failed to apply procedure markdown.'),
        detail: message,
      },
      { status: 400 },
    )
  }
}
