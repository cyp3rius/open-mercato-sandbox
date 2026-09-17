import type { EntityManager } from '@mikro-orm/postgresql'
import type { SearchService } from '@open-mercato/search'
import { CustomerEntity } from '@open-mercato/core/modules/customers/data/entities'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import { sanitizeSearchTerm } from '@open-mercato/shared/lib/query/sanitizeSearchTerm'
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

async function searchViaSqlFallback(
  params: ResolveTripListSearchIdsParams,
  term: string,
): Promise<string[]> {
  const like = `%${escapeLikePattern(term)}%`
  const connection = params.em.getConnection()
  const orgIds =
    Array.isArray(params.organizationIds) && params.organizationIds.length > 0
      ? params.organizationIds
      : params.organizationId
        ? [params.organizationId]
        : []

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

  const customerWhere: Record<string, unknown> = {
    tenantId: params.tenantId,
    deletedAt: null,
    displayName: { $ilike: like },
  }
  if (orgIds.length === 1) {
    customerWhere.organizationId = orgIds[0]
  } else if (orgIds.length > 1) {
    customerWhere.organizationId = { $in: orgIds }
  }

  const customers = await params.em.find(CustomerEntity, customerWhere, {
    fields: ['id'],
    limit: SEARCH_HIT_LIMIT,
  })
  const customerIds = customers.map((row) => row.id).filter(Boolean)
  if (customerIds.length > 0) {
    const tripWhere: Record<string, unknown> = {
      tenantId: params.tenantId,
      deletedAt: null,
      $or: [
        { customerPersonId: { $in: customerIds } },
        { customerCompanyId: { $in: customerIds } },
      ],
    }
    if (orgIds.length === 1) {
      tripWhere.organizationId = orgIds[0]
    } else if (orgIds.length > 1) {
      tripWhere.organizationId = { $in: orgIds }
    }
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
 * Resolve trip IDs matching a free-text search (addresses + customer name).
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
