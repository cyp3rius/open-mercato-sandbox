import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandRuntimeContext, CommandBus } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { ResourcesResourceGalleryItem } from '../../data/entities'
import {
  resourcesResourceGalleryItemCreateSchema,
  resourcesResourceGalleryItemDeleteSchema,
  resourcesResourceGalleryReorderSchema,
  type ResourcesResourceGalleryItemCreateInput,
  type ResourcesResourceGalleryItemDeleteInput,
  type ResourcesResourceGalleryReorderInput,
} from '../../data/validators'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['resources.view'] },
  POST: { requireAuth: true, requireFeatures: ['resources.manage_resources'] },
  PATCH: { requireAuth: true, requireFeatures: ['resources.manage_resources'] },
  DELETE: { requireAuth: true, requireFeatures: ['resources.manage_resources'] },
}

async function buildContext(
  req: Request,
): Promise<{ ctx: CommandRuntimeContext; translate: (key: string, fallback?: string) => string }> {
  const container = await createRequestContainer()
  const auth = await getAuthFromRequest(req)
  const { translate } = await resolveTranslations()
  if (!auth) throw new CrudHttpError(401, { error: translate('errors.unauthorized', 'Unauthorized') })
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  const ctx: CommandRuntimeContext = {
    container,
    auth,
    organizationScope: scope,
    selectedOrganizationId: scope?.selectedId ?? auth.orgId ?? null,
    organizationIds: scope?.filterIds ?? (auth.orgId ? [auth.orgId] : null),
    request: req,
  }
  return { ctx, translate }
}

const resourceQuerySchema = z.object({
  resourceId: z.string().uuid(),
})

export async function GET(req: Request) {
  try {
    const { ctx, translate } = await buildContext(req)
    const url = new URL(req.url)
    const parsed = resourceQuerySchema.safeParse({ resourceId: url.searchParams.get('resourceId') })
    if (!parsed.success) {
      return NextResponse.json(
        { error: translate('resources.gallery.error.resourceRequired', 'resourceId is required.') },
        { status: 400 },
      )
    }
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const scope: Record<string, unknown> = {}
    if (ctx.auth?.tenantId) scope.tenantId = ctx.auth.tenantId
    const orgId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
    if (orgId) scope.organizationId = orgId
    const rows = await em.find(
      ResourcesResourceGalleryItem,
      { resource: { id: parsed.data.resourceId }, ...scope },
      { orderBy: { sortOrder: 'ASC', createdAt: 'ASC' } },
    )
    const items = rows.map((row) => ({
      id: row.id,
      attachmentId: row.attachmentId,
      sortOrder: row.sortOrder,
    }))
    return NextResponse.json({ items })
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    const { translate } = await resolveTranslations()
    console.error('resource-gallery GET failed', err)
    return NextResponse.json(
      { error: translate('resources.gallery.error.load', 'Failed to load gallery.') },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  try {
    const { ctx, translate } = await buildContext(req)
    const body = await req.json().catch(() => ({}))
    const input = parseScopedCommandInput(resourcesResourceGalleryItemCreateSchema, body, ctx, translate)
    const commandBus = (ctx.container.resolve('commandBus') as CommandBus)
    const { result } = await commandBus.execute<ResourcesResourceGalleryItemCreateInput, { galleryItemId: string }>(
      'resources.resource_gallery_items.create',
      { input, ctx },
    )
    return NextResponse.json({ id: result?.galleryItemId ?? null }, { status: 201 })
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    const { translate } = await resolveTranslations()
    console.error('resource-gallery POST failed', err)
    return NextResponse.json(
      { error: translate('resources.gallery.error.save', 'Failed to add gallery item.') },
      { status: 400 },
    )
  }
}

export async function PATCH(req: Request) {
  try {
    const { ctx, translate } = await buildContext(req)
    const body = await req.json().catch(() => ({}))
    const input = parseScopedCommandInput(resourcesResourceGalleryReorderSchema, body, ctx, translate)
    const commandBus = (ctx.container.resolve('commandBus') as CommandBus)
    await commandBus.execute<ResourcesResourceGalleryReorderInput, { resourceId: string }>(
      'resources.resource_gallery_items.reorder',
      { input, ctx },
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    const { translate } = await resolveTranslations()
    console.error('resource-gallery PATCH failed', err)
    return NextResponse.json(
      { error: translate('resources.gallery.error.reorder', 'Failed to reorder gallery.') },
      { status: 400 },
    )
  }
}

export async function DELETE(req: Request) {
  try {
    const { ctx, translate } = await buildContext(req)
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    const input = parseScopedCommandInput(resourcesResourceGalleryItemDeleteSchema, { id }, ctx, translate)
    const commandBus = (ctx.container.resolve('commandBus') as CommandBus)
    await commandBus.execute<ResourcesResourceGalleryItemDeleteInput, { galleryItemId: string }>(
      'resources.resource_gallery_items.delete',
      { input, ctx },
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    const { translate } = await resolveTranslations()
    console.error('resource-gallery DELETE failed', err)
    return NextResponse.json(
      { error: translate('resources.gallery.error.delete', 'Failed to remove gallery item.') },
      { status: 400 },
    )
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Resources',
  summary: 'Vehicle resource photo gallery',
  methods: {
    GET: {
      summary: 'List gallery items for a vehicle resource',
      query: resourceQuerySchema,
      responses: [{ status: 200, description: 'Gallery rows', schema: z.object({ items: z.array(z.unknown()) }) }],
      errors: [{ status: 400, description: 'Bad request', schema: z.object({ error: z.string() }) }],
    },
  },
}
