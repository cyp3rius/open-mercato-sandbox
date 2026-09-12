import type { EntityManager } from '@mikro-orm/postgresql'
import { CustomerEntity } from '@open-mercato/core/modules/customers/data/entities'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import type { TaxiFleetTrip } from '../data/entities'
import { tripRequestDetailsFromMetadata } from './tripRequestForm'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function needsCustomerEnrichment(
  metadata: Record<string, unknown> | null | undefined,
  trip: Pick<TaxiFleetTrip, 'customerPersonId' | 'customerCompanyId'>,
): boolean {
  if (!trip.customerPersonId && !trip.customerCompanyId) return false
  const details = tripRequestDetailsFromMetadata(metadata ?? null)
  const hasName = Boolean(details.companyName || details.contactName)
  const hasPhone = Boolean(details.contactPhone)
  if (!hasName || !hasPhone) return true
  if (trip.customerCompanyId && !details.companyTaxId) return true
  return false
}

/**
 * Fills missing tripRequest contact fields from linked CRM person/company entities
 * (display name, phone, NIP) for driver trip list/detail payloads.
 */
export async function enrichDriverTripsCustomerMetadata(
  em: EntityManager,
  trips: TaxiFleetTrip[],
  scope: { tenantId: string; organizationId: string },
): Promise<Map<string, Record<string, unknown> | null>> {
  const result = new Map<string, Record<string, unknown> | null>()
  const entityIds = new Set<string>()

  for (const trip of trips) {
    const metadata =
      trip.metadata && typeof trip.metadata === 'object'
        ? (trip.metadata as Record<string, unknown>)
        : null
    result.set(trip.id, metadata)
    if (!needsCustomerEnrichment(metadata, trip)) continue
    if (trip.customerPersonId) entityIds.add(trip.customerPersonId)
    if (trip.customerCompanyId) entityIds.add(trip.customerCompanyId)
  }

  if (!entityIds.size) return result

  const entities = await findWithDecryption(
    em,
    CustomerEntity,
    {
      id: { $in: [...entityIds] },
      deletedAt: null,
    },
    { populate: ['companyProfile'] as never },
    { tenantId: scope.tenantId, organizationId: scope.organizationId },
  )
  const byId = new Map(entities.map((row) => [row.id, row]))

  for (const trip of trips) {
    const metadata = result.get(trip.id) ?? null
    if (!needsCustomerEnrichment(metadata, trip)) continue

    const person = trip.customerPersonId ? byId.get(trip.customerPersonId) : null
    const company = trip.customerCompanyId ? byId.get(trip.customerCompanyId) : null
    const entity = company ?? person
    if (!entity) continue

    const details = tripRequestDetailsFromMetadata(metadata)
    const isCompany = Boolean(company) || entity.kind === 'company'
    const displayName = entity.displayName?.trim() || ''
    const phone = entity.primaryPhone?.trim() || ''
    const nip = company?.companyProfile?.nip?.trim() || ''

    const contactName = details.contactName || (!isCompany ? displayName : details.contactName)
    const companyName = details.companyName || (isCompany ? displayName : details.companyName)
    const contactPhone = details.contactPhone || phone
    const companyTaxId = details.companyTaxId || nip
    const contactType = isCompany ? 'company' : details.contactType

    if (
      contactName === details.contactName &&
      companyName === details.companyName &&
      contactPhone === details.contactPhone &&
      companyTaxId === details.companyTaxId &&
      contactType === details.contactType
    ) {
      continue
    }

    const root = metadata ? { ...metadata } : {}
    const existingRequest = asRecord(root.tripRequest) ?? {}
    root.tripRequest = {
      ...existingRequest,
      contactName,
      companyName,
      contactPhone,
      companyTaxId,
      contactType,
    }
    result.set(trip.id, root)
  }

  return result
}
