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
import { ResourcesResourceAccessoryLink } from '../../data/entities'
import {
  resourcesResourceAccessoryLinkCreateSchema,
  resourcesResourceAccessoryLinkDeleteSchema,
  resourcesResourceAccessoryLinkUpdateSchema,
  type ResourcesResourceAccessoryLinkCreateInput,
  type ResourcesResourceAccessoryLinkDeleteInput,
  type ResourcesResourceAccessoryLinkUpdateInput,
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

const hostQuerySchema = z.object({
  hostResourceId: z.string().uuid(),
})

export async function GET(req: Request) {
  try {
    const { ctx, translate } = await buildContext(req)
    const url = new URL(req.url)
    const parsed = hostQuerySchema.safeParse({ hostResourceId: url.searchParams.get('hostResourceId') })
    if (!parsed.success) {
      return NextResponse.json({ error: translate('resources.accessories.error.hostRequired', 'hostResourceId is required.') }, { status: 400 })
    }
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const scope: Record<string, unknown> = {}
    if (ctx.auth?.tenantId) scope.tenantId = ctx.auth.tenantId
    const orgId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
    if (orgId) scope.organizationId = orgId
    const links = await em.find(
      ResourcesResourceAccessoryLink,
      { hostResource: { id: parsed.data.hostResourceId }, ...scope },
      { populate: ['accessoryResource'] },
    )
    const items = links.map((link: ResourcesResourceAccessoryLink) => {
      const acc = link.accessoryResource
      const resource =
        typeof acc === 'object' && acc !== null && 'id' in acc
          ? (acc as {
              id: string
              name?: string
              resourceTypeId?: string | null
              appearanceIcon?: string | null
              appearanceColor?: string | null
            })
          : null
      return {
        id: link.id,
        isMounted: link.isMounted,
        accessoryResourceId: resource?.id ?? null,
        accessoryName: resource?.name != null ? String(resource.name) : null,
        accessoryResourceTypeId: resource?.resourceTypeId ?? null,
        accessoryAppearanceIcon: resource?.appearanceIcon ?? null,
        accessoryAppearanceColor: resource?.appearanceColor ?? null,
      }
    })
    return NextResponse.json({ items })
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    const { translate } = await resolveTranslations()
    console.error('resource-accessory-links GET failed', err)
    return NextResponse.json({ error: translate('resources.accessories.error.load', 'Failed to load accessories.') }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { ctx, translate } = await buildContext(req)
    const body = await req.json().catch(() => ({}))
    const input = parseScopedCommandInput(resourcesResourceAccessoryLinkCreateSchema, body, ctx, translate)
    const commandBus = (ctx.container.resolve('commandBus') as CommandBus)
    const { result } = await commandBus.execute<ResourcesResourceAccessoryLinkCreateInput, { linkId: string }>(
      'resources.resource_accessory_links.create',
      { input, ctx },
    )
    return NextResponse.json({ id: result?.linkId ?? null }, { status: 201 })
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    const { translate } = await resolveTranslations()
    console.error('resource-accessory-links POST failed', err)
    return NextResponse.json({ error: translate('resources.accessories.error.save', 'Failed to save link.') }, { status: 400 })
  }
}

export async function PATCH(req: Request) {
  try {
    const { ctx, translate } = await buildContext(req)
    const body = await req.json().catch(() => ({}))
    const input = parseScopedCommandInput(resourcesResourceAccessoryLinkUpdateSchema, body, ctx, translate)
    const commandBus = (ctx.container.resolve('commandBus') as CommandBus)
    await commandBus.execute<ResourcesResourceAccessoryLinkUpdateInput, { linkId: string }>(
      'resources.resource_accessory_links.update',
      { input, ctx },
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    const { translate } = await resolveTranslations()
    console.error('resource-accessory-links PATCH failed', err)
    return NextResponse.json({ error: translate('resources.accessories.error.save', 'Failed to save link.') }, { status: 400 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { ctx, translate } = await buildContext(req)
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    const input = parseScopedCommandInput(
      resourcesResourceAccessoryLinkDeleteSchema,
      { id },
      ctx,
      translate,
    )
    const commandBus = (ctx.container.resolve('commandBus') as CommandBus)
    await commandBus.execute<ResourcesResourceAccessoryLinkDeleteInput, { linkId: string }>(
      'resources.resource_accessory_links.delete',
      { input, ctx },
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    const { translate } = await resolveTranslations()
    console.error('resource-accessory-links DELETE failed', err)
    return NextResponse.json({ error: translate('resources.accessories.error.delete', 'Failed to remove link.') }, { status: 400 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Resources',
  summary: 'Resource vehicle accessories',
  methods: {
    GET: {
      summary: 'List accessories for a vehicle resource',
      query: hostQuerySchema,
      responses: [{ status: 200, description: 'Accessory links', schema: z.object({ items: z.array(z.unknown()) }) }],
      errors: [{ status: 400, description: 'Bad request', schema: z.object({ error: z.string() }) }],
    },
  },
}
