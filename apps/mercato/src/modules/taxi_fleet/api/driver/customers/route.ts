import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CustomerEntity } from '@open-mercato/core/modules/customers/data/entities'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { resolveDriverContext } from '@/modules/taxi_fleet/lib/driverContext'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.driver'] },
  POST: { requireAuth: true, requireFeatures: ['taxi_fleet.driver'] },
}

const createCustomerSchema = z.object({
  kind: z.enum(['person', 'company']),
  displayName: z.string().trim().max(200).optional(),
  firstName: z.string().trim().max(120).optional(),
  lastName: z.string().trim().max(120).optional(),
  primaryPhone: z.string().trim().max(50).optional().nullable(),
  primaryEmail: z.string().trim().email().max(320).optional().nullable().or(z.literal('')),
})

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

function splitDisplayName(value: string): { firstName: string; lastName: string; displayName: string } {
  const collapsed = value.trim().replace(/\s+/g, ' ')
  if (!collapsed.length) {
    return { firstName: 'Klient', lastName: 'Taxi', displayName: 'Klient Taxi' }
  }
  const parts = collapsed.split(' ').filter(Boolean)
  if (parts.length >= 2) {
    return {
      firstName: parts[0]!,
      lastName: parts.slice(1).join(' '),
      displayName: collapsed,
    }
  }
  return { firstName: collapsed, lastName: collapsed, displayName: collapsed }
}

export async function GET(req: Request) {
  try {
    const context = await buildContext(req)
    const { translate } = await resolveTranslations()
    const driver = await resolveDriverContext(context, translate, { requireExternalApp: true })
    const url = new URL(req.url)
    const search = (url.searchParams.get('search') ?? '').trim()
    const em = context.container.resolve('em') as EntityManager
    const scope = {
      tenantId: driver.teamMember.tenantId,
      organizationId: driver.teamMember.organizationId,
    }
    const where: Record<string, unknown> = {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
      kind: { $in: ['person', 'company'] },
    }
    if (search.length) {
      const pattern = `%${search}%`
      where.$or = [
        { displayName: { $ilike: pattern } },
        { primaryEmail: { $ilike: pattern } },
        { primaryPhone: { $ilike: pattern } },
      ]
    }
    const rows = await findWithDecryption(
      em,
      CustomerEntity,
      where,
      { limit: 20, orderBy: { displayName: 'asc' } },
      scope,
    )
    return NextResponse.json({
      items: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        label: row.displayName,
        description: row.primaryPhone || row.primaryEmail || undefined,
      })),
    })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('taxi_fleet.driver.customers.list failed', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const context = await buildContext(req)
    const { translate } = await resolveTranslations()
    const driver = await resolveDriverContext(context, translate, { requireExternalApp: true })
    const body = createCustomerSchema.parse(await req.json().catch(() => ({})))
    const commandBus = context.container.resolve('commandBus') as CommandBus
    const tenantId = driver.teamMember.tenantId
    const organizationId = driver.teamMember.organizationId
    const phone = body.primaryPhone?.trim() || undefined
    const email = body.primaryEmail?.trim() || undefined

    if (body.kind === 'company') {
      const displayName = (body.displayName || body.firstName || '').trim()
      if (!displayName) {
        throw new CrudHttpError(400, {
          error: translate('taxi_fleet.driverApp.customers.nameRequired', 'Name is required.'),
        })
      }
      const { result } = await commandBus.execute('customers.companies.create', {
        input: {
          tenantId,
          organizationId,
          displayName,
          crmRecordType: 'customer',
          source: 'taxi_fleet_driver_app',
          status: 'active',
          ...(phone ? { primaryPhone: phone } : {}),
          ...(email ? { primaryEmail: email } : {}),
        },
        ctx: context,
      })
      const id = String((result as { entityId?: string; id?: string } | null)?.entityId
        ?? (result as { id?: string } | null)?.id
        ?? '')
      if (!id) throw new CrudHttpError(500, { error: 'Failed to create company' })
      return NextResponse.json({ id, kind: 'company', label: displayName }, { status: 201 })
    }

    const fromParts = {
      firstName: body.firstName?.trim() ?? '',
      lastName: body.lastName?.trim() ?? '',
    }
    const names =
      fromParts.firstName && fromParts.lastName
        ? {
            firstName: fromParts.firstName,
            lastName: fromParts.lastName,
            displayName: `${fromParts.firstName} ${fromParts.lastName}`.trim(),
          }
        : splitDisplayName(body.displayName || fromParts.firstName || fromParts.lastName || '')

    const { result } = await commandBus.execute('customers.people.create', {
      input: {
        tenantId,
        organizationId,
        firstName: names.firstName,
        lastName: names.lastName,
        displayName: names.displayName,
        crmRecordType: 'customer',
        source: 'taxi_fleet_driver_app',
        status: 'active',
        ...(phone ? { primaryPhone: phone } : {}),
        ...(email ? { primaryEmail: email } : {}),
      },
      ctx: context,
    })
    const id = String((result as { entityId?: string; id?: string } | null)?.entityId
      ?? (result as { id?: string } | null)?.id
      ?? '')
    if (!id) throw new CrudHttpError(500, { error: 'Failed to create person' })
    return NextResponse.json({ id, kind: 'person', label: names.displayName }, { status: 201 })
  } catch (err) {
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.flatten() }, { status: 400 })
    }
    console.error('taxi_fleet.driver.customers.create failed', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const openApi = {
  GET: { summary: 'Search customers for driver trip form', tags: ['Taxi fleet driver'] },
  POST: {
    summary: 'Create customer for driver trip form',
    tags: ['Taxi fleet driver'],
    requestBody: { schema: createCustomerSchema },
  },
}
