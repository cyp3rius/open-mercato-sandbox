import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { normalizeNipDigits } from '@open-mercato/shared/lib/pl/nip'
import { resolveDriverContext } from '@/modules/taxi_fleet/lib/driverContext'
import { normalizeDriverCustomerPhone } from '@/modules/taxi_fleet/lib/driverCustomerPhone'
import { searchFleetCustomerEntities } from '@/modules/taxi_fleet/lib/customerEntitySearch'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.driver'] },
  POST: { requireAuth: true, requireFeatures: ['taxi_fleet.driver'] },
}

const createCustomerSchema = z.object({
  kind: z.enum(['person', 'company']),
  displayName: z.string().trim().max(200).optional(),
  firstName: z.string().trim().max(120).optional(),
  lastName: z.string().trim().max(120).optional(),
  primaryPhone: z.string().trim().min(5).max(50),
  primaryEmail: z.string().trim().email().max(320).optional().nullable().or(z.literal('')),
  nip: z.string().trim().max(20).optional().nullable(),
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
  // Single token (e.g. phone-as-name): use it for both parts so CRM has a searchable label
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
    const items = await searchFleetCustomerEntities(em, {
      tenantId: driver.teamMember.tenantId,
      organizationId: driver.teamMember.organizationId,
      search,
      limit: 20,
    })
    return NextResponse.json({ items })
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
    const phone = normalizeDriverCustomerPhone(body.primaryPhone)
    if (!phone) {
      throw new CrudHttpError(400, {
        error: translate(
          'taxi_fleet.driverApp.customers.phoneInvalid',
          'Enter a valid phone number (e.g. 504 013 184 or +48 504 013 184).',
        ),
      })
    }
    const email = body.primaryEmail?.trim() || undefined
    const ownerUserId = context.auth?.sub ?? driver.teamMember.userId

    if (body.kind === 'company') {
      const nipDigits = body.nip ? normalizeNipDigits(body.nip) : null
      if (!nipDigits || nipDigits.length !== 10) {
        throw new CrudHttpError(400, {
          error: translate(
            'taxi_fleet.driverApp.customers.nipRequired',
            'NIP is required (10 digits).',
          ),
        })
      }
      const displayName =
        (body.displayName || body.firstName || '').trim() || phone
      const { result } = await commandBus.execute('customers.companies.create', {
        input: {
          tenantId,
          organizationId,
          displayName,
          crmRecordType: 'customer',
          source: 'taxi_fleet_driver_app',
          status: 'active',
          primaryPhone: phone,
          nip: nipDigits,
          ...(ownerUserId ? { ownerUserId } : {}),
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
        : splitDisplayName(
            body.displayName || fromParts.firstName || fromParts.lastName || phone,
          )

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
        primaryPhone: phone,
        ...(ownerUserId ? { ownerUserId } : {}),
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
    requestBody: { schema: createCustomerSchema },
    tags: ['Taxi fleet driver'],
  },
}
