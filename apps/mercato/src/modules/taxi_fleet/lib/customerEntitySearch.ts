import type { EntityManager } from '@mikro-orm/postgresql'
import {
  CustomerCompanyProfile,
  CustomerEntity,
  CustomerPersonProfile,
} from '@open-mercato/core/modules/customers/data/entities'
import { findWithDecryption, findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { hashToken, tokenizeText } from '@open-mercato/shared/lib/search/tokenize'
import { resolveSearchConfig } from '@open-mercato/shared/lib/search/config'
import { normalizeNipDigits } from '@open-mercato/shared/lib/pl/nip'
import { E } from '@/.mercato/generated/entities.ids.generated'

const CUSTOMER_SEARCH_ENTITY_TYPES = [
  E.customers.customer_entity,
  E.customers.customer_person_profile,
  E.customers.customer_company_profile,
] as const

export type FleetCustomerSearchItem = {
  id: string
  kind: 'person' | 'company' | string
  label: string
  description?: string
  linkedToCompany?: boolean
}

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

function looksEncryptedLabel(value: string): boolean {
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
  if (nipDigits && nipDigits.length >= 6) {
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
      if (
        storedNip &&
        (storedNip === nipDigits ||
          storedNip.includes(nipDigits) ||
          (nipDigits.length === 10 && nipDigits.includes(storedNip)))
      ) {
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

/**
 * Match display names / person first+last in memory after decryption.
 * SQL `$ilike` cannot match encrypted customer fields.
 */
async function findCustomerEntityIdsByDecryptedName(
  em: EntityManager,
  params: { tenantId: string; organizationId: string; search: string; limit: number },
): Promise<string[]> {
  const search = params.search.trim()
  if (search.length < 2) return []
  const needle = search.toLowerCase()
  const scope = { tenantId: params.tenantId, organizationId: params.organizationId }
  const ids = new Set<string>()

  const entities = await findWithDecryption(
    em,
    CustomerEntity,
    {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      deletedAt: null,
      kind: { $in: ['person', 'company'] },
    },
    { limit: Math.max(params.limit * 4, 400) },
    scope,
  )
  for (const entity of entities) {
    const label = entity.displayName?.trim() || ''
    if (!label || looksEncryptedLabel(label)) continue
    if (label.toLowerCase().includes(needle)) ids.add(entity.id)
  }

  const people = await findWithDecryption(
    em,
    CustomerPersonProfile,
    {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
    },
    { limit: Math.max(params.limit * 4, 400), populate: ['entity'] as never },
    scope,
  )
  for (const profile of people) {
    const first = profile.firstName?.trim() || ''
    const last = profile.lastName?.trim() || ''
    const haystack = `${first} ${last}`.trim().toLowerCase()
    if (!haystack || looksEncryptedLabel(first) || looksEncryptedLabel(last)) continue
    if (!haystack.includes(needle) && !first.toLowerCase().includes(needle) && !last.toLowerCase().includes(needle)) {
      continue
    }
    const entity = profile.entity
    const entityId =
      typeof entity === 'string'
        ? entity
        : entity && typeof entity === 'object' && typeof entity.id === 'string'
          ? entity.id
          : ''
    if (entityId) ids.add(entityId)
  }

  return [...ids].slice(0, params.limit)
}

/**
 * Resolve CRM customer entity IDs for free-text search (tokens + phone/NIP + decrypted names).
 * Safe for encrypted customer fields (unlike SQL `$ilike` on ciphertext).
 */
export async function resolveFleetCustomerEntityIdsBySearch(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    search: string
    limit?: number
  },
): Promise<string[]> {
  const limit = params.limit ?? 100
  const search = params.search.trim()
  if (!search) return []
  const minLen = resolveSearchConfig().minTokenLength
  const digitLen = digitsOnly(search).length
  if (search.length < minLen && digitLen < 6) return []

  const [tokenIds, contactIds, nameIds] = await Promise.all([
    findCustomerEntityIdsBySearchTokens(em, { ...params, search, limit }),
    findCustomerEntityIdsByPhoneOrNip(em, { ...params, search, limit }),
    findCustomerEntityIdsByDecryptedName(em, { ...params, search, limit }),
  ])
  return [...new Set([...tokenIds, ...contactIds, ...nameIds])].slice(0, limit)
}

function mapCustomerEntityToSearchItem(
  row: CustomerEntity,
  options?: { linkedToCompany?: boolean },
): FleetCustomerSearchItem | null {
  const label = row.displayName?.trim() || row.id
  if (looksEncryptedLabel(label)) return null
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
    ...(options?.linkedToCompany ? { linkedToCompany: true } : {}),
  }
}

function matchesSearchQuery(item: FleetCustomerSearchItem, search: string): boolean {
  const q = search.trim().toLowerCase()
  if (!q.length) return true
  const haystack = `${item.label} ${item.description ?? ''}`.toLowerCase()
  return haystack.includes(q)
}

async function listFleetPeopleLinkedToCompany(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    companyEntityId: string
    search: string
    limit: number
  },
): Promise<FleetCustomerSearchItem[]> {
  const companyEntityId = params.companyEntityId.trim()
  if (!companyEntityId) return []

  const profiles = await em.find(
    CustomerPersonProfile,
    {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      company: companyEntityId,
    },
    {
      limit: Math.max(params.limit * 2, 40),
      orderBy: { updatedAt: 'DESC' },
    },
  )
  const entityIds = profiles
    .map((profile) => {
      const entity = profile.entity
      if (typeof entity === 'string') return entity
      if (entity && typeof entity === 'object' && typeof entity.id === 'string') return entity.id
      return ''
    })
    .filter((id) => id.length > 0)
  if (!entityIds.length) return []

  const scope = { tenantId: params.tenantId, organizationId: params.organizationId }
  const rows = await findWithDecryption(
    em,
    CustomerEntity,
    {
      id: { $in: entityIds },
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      deletedAt: null,
      kind: 'person',
    },
    { limit: entityIds.length },
    scope,
  )
  const order = new Map(entityIds.map((id, index) => [id, index]))
  return rows
    .slice()
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map((row) => mapCustomerEntityToSearchItem(row, { linkedToCompany: true }))
    .filter((item): item is FleetCustomerSearchItem => item !== null)
    .filter((item) => matchesSearchQuery(item, params.search))
    .slice(0, params.limit)
}

export async function searchFleetCustomerEntities(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    search: string
    limit?: number
    kind?: 'person' | 'company'
    companyEntityId?: string
  },
): Promise<FleetCustomerSearchItem[]> {
  const limit = params.limit ?? 20
  const search = params.search.trim()
  const minLen = resolveSearchConfig().minTokenLength
  const companyEntityId = params.companyEntityId?.trim() || ''
  const preferCompanyPeople = Boolean(companyEntityId) && params.kind === 'person'

  const linkedPeople = preferCompanyPeople
    ? await listFleetPeopleLinkedToCompany(em, {
        tenantId: params.tenantId,
        organizationId: params.organizationId,
        companyEntityId,
        search,
        limit,
      })
    : []

  if (search.length < minLen) {
    return linkedPeople.slice(0, limit)
  }

  const [tokenIds, contactIds, nameIds] = await Promise.all([
    findCustomerEntityIdsBySearchTokens(em, { ...params, search, limit }),
    findCustomerEntityIdsByPhoneOrNip(em, { ...params, search, limit }),
    findCustomerEntityIdsByDecryptedName(em, { ...params, search, limit }),
  ])
  const linkedIds = new Set(linkedPeople.map((item) => item.id))
  const matchedIds = [...new Set([...contactIds, ...tokenIds, ...nameIds])]
    .filter((id) => !linkedIds.has(id))
    .slice(0, limit)
  if (!matchedIds.length) return linkedPeople.slice(0, limit)

  const scope = { tenantId: params.tenantId, organizationId: params.organizationId }
  const kindFilter = params.kind
    ? params.kind
    : ({ $in: ['person', 'company'] as const })
  const rows = await findWithDecryption(
    em,
    CustomerEntity,
    {
      id: { $in: matchedIds },
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      deletedAt: null,
      kind: kindFilter,
    },
    { limit, populate: ['companyProfile'] as never },
    scope,
  )
  const order = new Map(matchedIds.map((id, index) => [id, index]))
  const others = rows
    .slice()
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map((row) => mapCustomerEntityToSearchItem(row))
    .filter((item): item is FleetCustomerSearchItem => item !== null)

  return [...linkedPeople, ...others].slice(0, limit)
}

export async function resolveFleetCustomerEntityLabel(
  em: EntityManager,
  params: { tenantId: string; organizationId: string; entityId: string },
): Promise<string | null> {
  const resolved = await resolveFleetCustomerEntity(em, params)
  return resolved?.label ?? null
}

export async function resolveFleetCustomerEntity(
  em: EntityManager,
  params: { tenantId: string; organizationId: string; entityId: string },
): Promise<{ label: string; kind: 'person' | 'company' | string } | null> {
  const entityId = params.entityId.trim()
  if (!entityId.length) return null
  const scope = { tenantId: params.tenantId, organizationId: params.organizationId }
  // Prefer org-scoped lookup, then tenant-wide (customer may live in another org in the scope).
  const scoped = await findOneWithDecryption(
    em,
    CustomerEntity,
    {
      id: entityId,
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      deletedAt: null,
    },
    {},
    scope,
  )
  const row =
    scoped ??
    (await findOneWithDecryption(
      em,
      CustomerEntity,
      {
        id: entityId,
        tenantId: params.tenantId,
        deletedAt: null,
      },
      {},
      scope,
    ))
  if (!row) return null
  const label = row.displayName?.trim() || ''
  if (!label.length || looksEncryptedLabel(label)) return null
  return { label, kind: row.kind }
}
