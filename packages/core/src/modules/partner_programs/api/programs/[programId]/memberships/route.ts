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
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { PartnerProgram, PartnerProgramMembership } from '../../../../data/entities'
import {
  partnerProgramMembershipCreateSchema,
  partnerProgramMembershipDeleteSchema,
  type PartnerProgramMembershipCreateInput,
} from '../../../../data/validators'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['partner_programs.view'] },
  POST: { requireAuth: true, requireFeatures: ['partner_programs.manage_memberships'] },
  DELETE: { requireAuth: true, requireFeatures: ['partner_programs.manage_memberships'] },
}

const paramsSchema = z.object({
  programId: z.string().uuid(),
})

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

export async function GET(req: Request, routeContext: { params?: { programId?: string } }) {
  try {
    const { ctx, translate } = await buildContext(req)
    const parsed = paramsSchema.safeParse({ programId: routeContext.params?.programId })
    if (!parsed.success) {
      return NextResponse.json({ error: translate('partner_programs.errors.invalidProgramId', 'Invalid program id.') }, { status: 400 })
    }
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const program = await em.findOne(PartnerProgram, {
      id: parsed.data.programId,
      tenantId: ctx.auth?.tenantId ?? undefined,
      deletedAt: null,
    })
    if (!program) {
      return NextResponse.json({ error: translate('partner_programs.errors.programNotFound', 'Program not found.') }, { status: 404 })
    }
    const orgId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
    if (orgId && program.organizationId !== orgId) {
      return NextResponse.json({ error: translate('errors.forbidden', 'Forbidden') }, { status: 403 })
    }
    const rows = await em.find(
      PartnerProgramMembership,
      {
        program: program.id,
        tenantId: ctx.auth?.tenantId ?? undefined,
        deletedAt: null,
        ...(orgId ? { organizationId: orgId } : {}),
      },
      { orderBy: { joinedAt: 'DESC' } },
    )
    const items = rows.map((row) => ({
      id: row.id,
      customerEntityId: row.customerEntityId,
      role: row.role ?? null,
      joinedAt: row.joinedAt.toISOString(),
      leftAt: row.leftAt ? row.leftAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }))
    return NextResponse.json({ items, total: items.length })
  } catch (err) {
    if (isCrudHttpError(err)) {
      return NextResponse.json(err.body, { status: err.status })
    }
    console.error('partner_programs memberships GET', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('partner_programs.errors.loadMembers', 'Failed to load members.') }, { status: 500 })
  }
}

export async function POST(req: Request, routeContext: { params?: { programId?: string } }) {
  try {
    const { ctx, translate } = await buildContext(req)
    const parsedParams = paramsSchema.safeParse({ programId: routeContext.params?.programId })
    if (!parsedParams.success) {
      return NextResponse.json({ error: translate('partner_programs.errors.invalidProgramId', 'Invalid program id.') }, { status: 400 })
    }
    const body = await req.json().catch(() => ({}))
    const merged = { ...(body as Record<string, unknown>), programId: parsedParams.data.programId }
    const input = parseScopedCommandInput(partnerProgramMembershipCreateSchema, merged, ctx, translate)
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute<PartnerProgramMembershipCreateInput, { membershipId: string }>(
      'partner_programs.memberships.create',
      { input, ctx },
    )
    return NextResponse.json({ id: result.membershipId }, { status: 201 })
  } catch (err) {
    if (isCrudHttpError(err)) {
      return NextResponse.json(err.body, { status: err.status })
    }
    console.error('partner_programs memberships POST', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('partner_programs.errors.createMember', 'Failed to add member.') }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { ctx, translate } = await buildContext(req)
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    const parsed = partnerProgramMembershipDeleteSchema.safeParse({ id })
    if (!parsed.success) {
      return NextResponse.json({ error: translate('partner_programs.errors.membershipIdRequired', 'Membership id is required.') }, { status: 400 })
    }
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    await commandBus.execute('partner_programs.memberships.delete', {
      input: parsed.data,
      ctx,
    })
    return NextResponse.json({ ok: true as const })
  } catch (err) {
    if (isCrudHttpError(err)) {
      return NextResponse.json(err.body, { status: err.status })
    }
    console.error('partner_programs memberships DELETE', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('partner_programs.errors.deleteMember', 'Failed to remove member.') }, { status: 500 })
  }
}
