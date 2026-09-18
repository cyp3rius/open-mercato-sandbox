import type { EntityManager } from '@mikro-orm/postgresql'
import type { SearchService } from '@open-mercato/search'
import {
  CustomerCompanyProfile,
  CustomerEntity,
  CustomerPersonProfile,
} from '@open-mercato/core/modules/customers/data/entities'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import { sanitizeSearchTerm } from '@open-mercato/shared/lib/query/sanitizeSearchTerm'
import { normalizeNipDigits } from '@open-mercato/shared/lib/pl/nip'
import { E } from '@/.mercato/generated/entities.ids.generated'
import { TaxiFleetTrip } from '../data/entities'

const SEARCH_HIT_LIMIT = 500

export function intersectIdLists(left: string[], right: string[]): string[] {
  if (left.length === 0) return []
  if (right.length === 0) return []
  const rightSet = new Set(right)
  return left.filter((id) => rightSet.has(id))
}

export function mergeIdFilter(existingIds: string[] | undefined, searchIds: string[]): string[] {
  if (!existingIds || existingIds.length === 0) return searchIds
  return intersectIdLists(existingIds, searchIds)
}

type ResolveTripListSearchIdsParams = {
  search: string
  tenantId: string
  organizationId?: string | null
  organizationIds?: string[] | null
  container: { resolve: (name: string) => unknown }
  em: EntityManager
}

async function searchViaSearchService(
  params: ResolveTripListSearchIdsParams,
  term: string,
): Promise<string[] | null> {
  let searchService: SearchService | undefined
  try {
    searchService = params.container.resolve('searchService') as SearchService | undefined
  } catch {
    return null
  }
  if (!searchService) return null

  try {
    const results = await searchService.search(term, {
      tenantId: params.tenantId,
      organizationId: params.organizationId ?? undefined,
      entityTypes: [E.taxi_fleet.taxi_fleet_trip],
      strategies: ['fulltext', 'vector', 'tokens'],
      limit: SEARCH_HIT_LIMIT,
    })
    return [
      ...new Set(
        results
          .map((hit) => (typeof hit.recordId === 'string' ? hit.recordId.trim() : ''))
          .filter((id) => id.length > 0),
      ),
    ]
  } catch {
    return null
  }
}

function resolveOrgIds(params: ResolveTripListSearchIdsParams): string[] {
  if (Array.isArray(params.organizationIds) && params.organizationIds.length > 0) {
    return params.organizationIds
  }
  return params.organizationId ? [params.organizationId] : []
}

function applyOrgScope(
  where: Record<string, unknown>,
  orgIds: string[],
): Record<string, unknown> {
  if (orgIds.length === 1) {
    where.organizationId = orgIds[0]
  } else if (orgIds.length > 1) {
    where.organizationId = { $in: orgIds }
  }
  return where
}

async function findMatchingCustomerEntityIds(
  params: ResolveTripListSearchIdsParams,
  term: string,
): Promise<string[]> {
  const like = `%${escapeLikePattern(term)}%`
  const orgIds = resolveOrgIds(params)
  const scope = {
    tenantId: params.tenantId,
    organizationId: orgIds[0] ?? params.organizationId ?? params.tenantId,
  }
  const ids = new Set<string>()

  const entityWhere = applyOrgScope(
    {
      tenantId: params.tenantId,
      deletedAt: null,
      $or: [{ displayName: { $ilike: like } }, { primaryPhone: { $ilike: like } }],
    },
    orgIds,
  )
  const entities = await findWithDecryption(
    params.em,
    CustomerEntity,
    entityWhere,
    { fields: ['id'], limit: SEARCH_HIT_LIMIT },
    scope,
  )
  for (const row of entities) {
    if (row.id) ids.add(row.id)
  }

  const personWhere = applyOrgScope(
    {
      tenantId: params.tenantId,
      $or: [{ firstName: { $ilike: like } }, { lastName: { $ilike: like } }],
    },
    orgIds,
  )
  const people = await findWithDecryption(
    params.em,
    CustomerPersonProfile,
    personWhere,
    { fields: ['id', 'entity'], limit: SEARCH_HIT_LIMIT },
    scope,
  )
  for (const profile of people) {
    const entity = profile.entity
    const entityId =
      typeof entity === 'string'
        ? entity
        : entity && typeof entity === 'object' && typeof entity.id === 'string'
          ? entity.id
          : ''
    if (entityId) ids.add(entityId)
  }

  const nipDigits = normalizeNipDigits(term)
  if (nipDigits && nipDigits.length >= 6) {
    const companyWhere = applyOrgScope(
      {
        tenantId: params.tenantId,
        nip: { $ilike: `%${escapeLikePattern(nipDigits)}%` },
      },
      orgIds,
    )
    const companies = await findWithDecryption(
      params.em,
      CustomerCompanyProfile,
      companyWhere,
      { fields: ['id', 'entity'], limit: SEARCH_HIT_LIMIT },
      scope,
    )
    for (const profile of companies) {
      const entity = profile.entity
      const entityId =
        typeof entity === 'string'
          ? entity
          : entity && typeof entity === 'object' && typeof entity.id === 'string'
            ? entity.id
            : ''
      if (entityId) ids.add(entityId)
    }
  }

  const phoneDigits = term.replace(/\D/g, '')
  if (phoneDigits.length >= 6) {
    const phoneWhere = applyOrgScope(
      {
        tenantId: params.tenantId,
        deletedAt: null,
        primaryPhone: { $ilike: `%${escapeLikePattern(phoneDigits)}%` },
      },
      orgIds,
    )
    const phoneHits = await findWithDecryption(
      params.em,
      CustomerEntity,
      phoneWhere,
      { fields: ['id'], limit: SEARCH_HIT_LIMIT },
      scope,
    )
    for (const row of phoneHits) {
      if (row.id) ids.add(row.id)
    }
  }

  return [...ids]
}

async function searchViaSqlFallback(
  params: ResolveTripListSearchIdsParams,
  term: string,
): Promise<string[]> {
  const like = `%${escapeLikePattern(term)}%`
  const connection = params.em.getConnection()
  const orgIds = resolveOrgIds(params)

  const sqlParams: unknown[] = [params.tenantId, like, like, like, like, like]
  let orgClause = ''
  if (orgIds.length === 1) {
    orgClause = ' and organization_id = ?'
    sqlParams.push(orgIds[0])
  } else if (orgIds.length > 1) {
    orgClause = ` and organization_id in (${orgIds.map(() => '?').join(', ')})`
    sqlParams.push(...orgIds)
  }
  sqlParams.push(SEARCH_HIT_LIMIT)

  const addressRows = (await connection.execute(
    `select id
     from taxi_fleet_trips
     where deleted_at is null
       and tenant_id = ?
       and (
         coalesce(metadata->'tripRequest'->>'fromAddress', '') ilike ?
         or coalesce(metadata->'tripRequest'->>'toAddress', '') ilike ?
         or coalesce(metadata->'tripRequest'->>'waypointAddresses', '') ilike ?
         or coalesce(metadata->'tripRequest'->>'contactName', '') ilike ?
         or coalesce(metadata->'tripRequest'->>'companyName', '') ilike ?
       )
       ${orgClause}
     limit ?`,
    sqlParams,
  )) as Array<{ id?: string }>

  const ids = new Set(
    addressRows
      .map((row) => (typeof row.id === 'string' ? row.id : ''))
      .filter((id) => id.length > 0),
  )

  const customerIds = await findMatchingCustomerEntityIds(params, term)
  if (customerIds.length > 0) {
    const tripWhere = applyOrgScope(
      {
        tenantId: params.tenantId,
        deletedAt: null,
        $or: [
          { customerPersonId: { $in: customerIds } },
          { customerCompanyId: { $in: customerIds } },
          { orderingPersonId: { $in: customerIds } },
        ],
      },
      orgIds,
    )
    const linkedTrips = await params.em.find(TaxiFleetTrip, tripWhere, {
      fields: ['id'],
      limit: SEARCH_HIT_LIMIT,
    })
    for (const trip of linkedTrips) {
      if (trip.id) ids.add(trip.id)
    }
  }

  return [...ids]
}

/**
 * Resolve trip IDs matching a free-text search (addresses + customer / ordering party).
 * Prefers SearchService (fulltext/vector/tokens); falls back to SQL when unavailable.
 */
export async function resolveTripListSearchIds(
  params: ResolveTripListSearchIdsParams,
): Promise<string[]> {
  const term = sanitizeSearchTerm(params.search)
  if (!term) return []

  const viaSearch = await searchViaSearchService(params, term)
  if (viaSearch !== null) return viaSearch

  return searchViaSqlFallback(params, term)
}
