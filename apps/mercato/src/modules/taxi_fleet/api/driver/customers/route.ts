import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import {
  CustomerCompanyProfile,
  CustomerEntity,
} from '@open-mercato/core/modules/customers/data/entities'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { hashToken, tokenizeText } from '@open-mercato/shared/lib/search/tokenize'
import { resolveSearchConfig } from '@open-mercato/shared/lib/search/config'
import { normalizeNipDigits } from '@open-mercato/shared/lib/pl/nip'
import { E } from '@/.mercato/generated/entities.ids.generated'
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
  primaryPhone: z.string().trim().min(5).max(50),
  primaryEmail: z.string().trim().email().max(320).optional().nullable().or(z.literal('')),
  nip: z.string().trim().max(20).optional().nullable(),
})

const CUSTOMER_SEARCH_ENTITY_TYPES = [
  E.customers.customer_entity,
  E.customers.customer_person_profile,
  E.customers.customer_company_profile,
] as const

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

function phoneMatches(stored: string | null | undefined, queryDigits: string): boolean {
  if (!stored || !queryDigits) return false
  const phoneDigits = digitsOnly(stored)
  if (phoneDigits.length < 6) return false
  return (
    phoneDigits === queryDigits ||
    phoneDigits.endsWith(queryDigits) ||
    queryDigits.endsWith(phoneDigits)
  )
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

function looksEncryptedLabel(value: string): boolean {
  // AES-GCM payloads are colon-separated ciphertext chunks, not display names.
  return value.includes(':') && value.length > 40
}

async function findCustomerEntityIdsBySearchTokens(
  em: EntityManager,
  params: { tenantId: string; organizationId: string; search: string; limit: number },
): Promise<string[]> {
  const config = resolveSearchConfig()
  const { tokens } = tokenizeText(params.search, config)
  const digitQuery = digitsOnly(params.search)
  const candidateTokens = new Set(tokens)
  if (digitQuery.length >= config.minTokenLength) {
    candidateTokens.add(digitQuery)
    if (digitQuery.length > 9) candidateTokens.add(digitQuery.slice(-9))
    if (digitQuery.length > 10) candidateTokens.add(digitQuery.slice(-10))
  }
  if (!candidateTokens.size) return []

  const hashes = [...candidateTokens].map((token) => hashToken(token, config))
  const knex = em.getConnection().getKnex()

  const tokenRows = await knex('search_tokens')
    .select('entity_type', 'entity_id')
    .distinct()
    .whereIn('token_hash', hashes)
    .andWhere({
      tenant_id: params.tenantId,
      organization_id: params.organizationId,
    })
    .whereIn('entity_type', [...CUSTOMER_SEARCH_ENTITY_TYPES])
    .limit(Math.max(params.limit * 8, 40))

  const entityIds = new Set<string>()
  const personProfileIds: string[] = []
  const companyProfileIds: string[] = []
  for (const row of tokenRows as Array<{ entity_type?: unknown; entity_id?: unknown }>) {
    const entityType = typeof row.entity_type === 'string' ? row.entity_type : ''
    const recordId = typeof row.entity_id === 'string' ? row.entity_id : ''
    if (!recordId) continue
    if (entityType === E.customers.customer_entity) entityIds.add(recordId)
    else if (entityType === E.customers.customer_person_profile) personProfileIds.push(recordId)
    else if (entityType === E.customers.customer_company_profile) companyProfileIds.push(recordId)
  }

  if (personProfileIds.length) {
    const people = await knex('customer_people')
      .select('entity_id')
      .whereIn('id', personProfileIds)
      .andWhere({ tenant_id: params.tenantId, organization_id: params.organizationId })
    for (const row of people as Array<{ entity_id?: unknown }>) {
      if (typeof row.entity_id === 'string' && row.entity_id) entityIds.add(row.entity_id)
    }
  }
  if (companyProfileIds.length) {
    const companies = await knex('customer_companies')
      .select('entity_id')
      .whereIn('id', companyProfileIds)
      .andWhere({ tenant_id: params.tenantId, organization_id: params.organizationId })
    for (const row of companies as Array<{ entity_id?: unknown }>) {
      if (typeof row.entity_id === 'string' && row.entity_id) entityIds.add(row.entity_id)
    }
  }

  return [...entityIds].slice(0, params.limit)
}

async function findCustomerEntityIdsByPhoneOrNip(
  em: EntityManager,
  params: { tenantId: string; organizationId: string; search: string; limit: number },
): Promise<string[]> {
  const queryDigits = digitsOnly(params.search)
  if (queryDigits.length < 6) return []
  const scope = { tenantId: params.tenantId, organizationId: params.organizationId }
  const ids = new Set<string>()

  const nipDigits = normalizeNipDigits(params.search)
  if (nipDigits && nipDigits.length === 10) {
    const companies = await findWithDecryption(
      em,
      CustomerCompanyProfile,
      {
        tenantId: params.tenantId,
        organizationId: params.organizationId,
      },
      { limit: 300, populate: ['entity'] as never },
      scope,
    )
    for (const company of companies) {
      const storedNip = normalizeNipDigits(company.nip ?? '')
      if (storedNip === nipDigits) {
        const entityId = company.entity?.id
        if (entityId) ids.add(entityId)
      }
    }
  }

  if (queryDigits.length >= 6) {
    const entities = await findWithDecryption(
      em,
      CustomerEntity,
      {
        tenantId: params.tenantId,
        organizationId: params.organizationId,
        deletedAt: null,
        kind: { $in: ['person', 'company'] },
        primaryPhone: { $ne: null },
      },
      { limit: 400 },
      scope,
    )
    for (const entity of entities) {
      if (phoneMatches(entity.primaryPhone, queryDigits)) ids.add(entity.id)
    }
  }

  return [...ids].slice(0, params.limit)
}

export async function GET(req: Request) {
  try {
    const context = await buildContext(req)
    const { translate } = await resolveTranslations()
    const driver = await resolveDriverContext(context, translate, { requireExternalApp: true })
    const url = new URL(req.url)
    const search = (url.searchParams.get('search') ?? '').trim()
    const minLen = resolveSearchConfig().minTokenLength
    if (search.length < minLen) {
      return NextResponse.json({ items: [] })
    }

    const em = context.container.resolve('em') as EntityManager
    const tenantId = driver.teamMember.tenantId
    const organizationId = driver.teamMember.organizationId
    const [tokenIds, contactIds] = await Promise.all([
      findCustomerEntityIdsBySearchTokens(em, {
        tenantId,
        organizationId,
        search,
        limit: 20,
      }),
      findCustomerEntityIdsByPhoneOrNip(em, {
        tenantId,
        organizationId,
        search,
        limit: 20,
      }),
    ])
    const matchedIds = [...new Set([...contactIds, ...tokenIds])].slice(0, 20)
    if (!matchedIds.length) {
      return NextResponse.json({ items: [] })
    }

    const scope = { tenantId, organizationId }
    const rows = await findWithDecryption(
      em,
      CustomerEntity,
      {
        id: { $in: matchedIds },
        tenantId,
        organizationId,
        deletedAt: null,
        kind: { $in: ['person', 'company'] },
      },
      { limit: 20, populate: ['companyProfile'] as never },
      scope,
    )
    const order = new Map(matchedIds.map((id, index) => [id, index]))
    const items = rows
      .slice()
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .map((row) => {
        const label = row.displayName?.trim() || row.id
        if (looksEncryptedLabel(label)) {
          return null
        }
        const phone = row.primaryPhone?.trim() || ''
        const email = row.primaryEmail?.trim() || ''
        const nip = normalizeNipDigits(row.companyProfile?.nip ?? '') || ''
        const descriptionParts: string[] = []
        if (phone && !looksEncryptedLabel(phone)) descriptionParts.push(phone)
        if (nip) descriptionParts.push(`NIP ${nip}`)
        if (!descriptionParts.length && email && !looksEncryptedLabel(email)) {
          descriptionParts.push(email)
        }
        return {
          id: row.id,
          kind: row.kind,
          label,
          description: descriptionParts.length ? descriptionParts.join(' · ') : undefined,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)

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
    const phone = body.primaryPhone.trim()
    if (phone.length < 5) {
      throw new CrudHttpError(400, {
        error: translate('taxi_fleet.driverApp.customers.phoneRequired', 'Phone number is required.'),
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
