import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { Playbook } from '../../data/entities'
import { exportProcedureDocument } from '../../lib/procedureMarkdownExport'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['playbooks.view'] },
  POST: { requireAuth: true, requireFeatures: ['playbooks.view'] },
}

export const openApi = {
  tags: ['Playbooks'],
  summary: 'Export playbook(s) to procedure Markdown',
}

const querySchema = z
  .object({
    slug: z.string().trim().min(1).optional(),
    id: z.string().uuid().optional(),
  })
  .refine((value) => Boolean(value.slug || value.id), { message: 'slug or id required' })

const batchBodySchema = z
  .object({
    ids: z.array(z.string().uuid()).optional(),
    slugs: z.array(z.string().trim().min(1)).optional(),
  })
  .refine((value) => (value.ids?.length ?? 0) + (value.slugs?.length ?? 0) > 0, {
    message: 'ids or slugs required',
  })

async function resolveScope(req: Request) {
  const container = await createRequestContainer()
  const auth = await getAuthFromRequest(req)
  if (!auth) throw new CrudHttpError(401, { error: 'Unauthorized' })
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  const tenantId = auth.tenantId
  const organizationId = scope?.selectedId ?? auth.orgId
  if (!tenantId || !organizationId) {
    throw new CrudHttpError(400, { error: 'Tenant and organization context are required.' })
  }
  const em = (container.resolve('em') as EntityManager).fork()
  return { em, tenantId, organizationId }
}

function toMarkdownPayload(row: Playbook) {
  const markdown = exportProcedureDocument({
    slug: row.slug,
    title: row.title,
    body: row.body,
    audience: row.audience,
    contextTags: row.contextTags ?? [],
    defaultSlaDuration: row.defaultSlaDuration ?? null,
    recommendedOwnerUserIds: row.recommendedOwnerUserIds ?? [],
    procedureDefinition: row.procedureDefinition ?? [],
  })
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    version: row.version,
    markdown,
  }
}

export async function GET(req: Request) {
  try {
    const { em, tenantId, organizationId } = await resolveScope(req)
    const url = new URL(req.url)
    const parsed = querySchema.parse({
      slug: url.searchParams.get('slug') ?? undefined,
      id: url.searchParams.get('id') ?? undefined,
    })
    const row = await em.findOne(Playbook, {
      tenantId,
      organizationId,
      deletedAt: null,
      ...(parsed.id
        ? { id: parsed.id }
        : { slug: parsed.slug!.trim().toLowerCase(), isActive: true }),
    })
    if (!row) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, ...toMarkdownPayload(row) })
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query', details: err.flatten() }, { status: 400 })
    }
    const { translate } = await resolveTranslations()
    console.error('playbooks.to-markdown GET failed', err)
    return NextResponse.json(
      { error: translate('playbooks.toMarkdown.errors.export', 'Failed to export procedure markdown.') },
      { status: 400 },
    )
  }
}

export async function POST(req: Request) {
  try {
    const { em, tenantId, organizationId } = await resolveScope(req)
    const raw = await req.json().catch(() => ({}))
    const parsed = batchBodySchema.parse(raw)
    const ids = parsed.ids ?? []
    const slugs = (parsed.slugs ?? []).map((s) => s.trim().toLowerCase())
    const orFilters: Array<Record<string, unknown>> = []
    if (ids.length) orFilters.push({ id: { $in: ids } })
    if (slugs.length) orFilters.push({ slug: { $in: slugs }, isActive: true })

    const rows = await em.find(
      Playbook,
      {
        tenantId,
        organizationId,
        deletedAt: null,
        $or: orFilters,
      },
      { orderBy: { slug: 'asc' } },
    )

    return NextResponse.json({
      ok: true,
      items: rows.map(toMarkdownPayload),
    })
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', details: err.flatten() }, { status: 400 })
    }
    const { translate } = await resolveTranslations()
    console.error('playbooks.to-markdown POST failed', err)
    return NextResponse.json(
      { error: translate('playbooks.toMarkdown.errors.export', 'Failed to export procedure markdown.') },
      { status: 400 },
    )
  }
}
