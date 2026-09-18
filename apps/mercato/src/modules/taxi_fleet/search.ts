import type {
  SearchModuleConfig,
  SearchBuildContext,
  SearchResultPresenter,
  SearchIndexSource,
} from '@open-mercato/shared/modules/search'
import type { QueryEngine } from '@open-mercato/shared/lib/query/types'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { normalizeNipDigits } from '@open-mercato/shared/lib/pl/nip'
import { E } from '@/.mercato/generated/entities.ids.generated'
import { TAXI_FLEET_BASE } from './backend/taxi-fleet/paths'
import {
  buildTripSearchTextLines,
  enrichTripRecordForSearch,
  readTripCustomerEntityId,
  readTripOrderingPersonId,
  type TripCustomerSearchEnrichment,
  TRIP_SEARCH_FIELD_POLICY_SEARCHABLE,
} from './lib/tripSearchFields'

function pickString(...candidates: Array<unknown>): string | null {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const trimmed = candidate.trim()
    if (trimmed.length > 0) return trimmed
  }
  return null
}

function formatSubtitle(...parts: Array<unknown>): string | undefined {
  const text = parts
    .map((part) => (part === null || part === undefined ? '' : String(part)))
    .map((part) => part.trim())
    .filter(Boolean)
  if (text.length === 0) return undefined
  return text.join(' · ')
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function nestedString(row: Record<string, unknown>, ...path: string[]): string {
  let current: unknown = row
  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return ''
    current = (current as Record<string, unknown>)[key]
  }
  return typeof current === 'string' ? current.trim() : ''
}

async function loadCustomerSearchEnrichment(
  ctx: SearchBuildContext,
  entityId: string | null,
): Promise<TripCustomerSearchEnrichment> {
  const empty: TripCustomerSearchEnrichment = {
    displayName: '',
    phone: '',
    nip: '',
    personName: '',
  }
  if (!entityId || !ctx.queryEngine || !ctx.tenantId) return empty
  const queryEngine = ctx.queryEngine as QueryEngine
  try {
    const result = await queryEngine.query(E.customers.customer_entity, {
      tenantId: ctx.tenantId,
      organizationId: ctx.organizationId ?? undefined,
      filters: { id: { $eq: entityId } },
      fields: [
        'id',
        'display_name',
        'primary_phone',
        'kind',
        'person_profile.first_name',
        'person_profile.last_name',
        'company_profile.nip',
      ],
      page: { page: 1, pageSize: 1 },
      skipAutoReindex: true,
    })
    const row = result.items[0] as Record<string, unknown> | undefined
    if (!row) return empty
    const displayName = pickString(row.display_name, row.displayName) ?? ''
    const phone = pickString(row.primary_phone, row.primaryPhone) ?? ''
    const personProfile = asRecord(row.person_profile) ?? asRecord(row.personProfile)
    const companyProfile = asRecord(row.company_profile) ?? asRecord(row.companyProfile)
    const firstName =
      nestedString(row, 'person_profile', 'first_name') ||
      nestedString(row, 'personProfile', 'firstName') ||
      (personProfile ? pickString(personProfile.first_name, personProfile.firstName) ?? '' : '')
    const lastName =
      nestedString(row, 'person_profile', 'last_name') ||
      nestedString(row, 'personProfile', 'lastName') ||
      (personProfile ? pickString(personProfile.last_name, personProfile.lastName) ?? '' : '')
    const personName = [firstName, lastName].filter(Boolean).join(' ').trim()
    const nipRaw =
      nestedString(row, 'company_profile', 'nip') ||
      nestedString(row, 'companyProfile', 'nip') ||
      (companyProfile ? pickString(companyProfile.nip) ?? '' : '')
    const nip = normalizeNipDigits(nipRaw) || nipRaw
    return {
      displayName,
      phone,
      nip,
      personName,
    }
  } catch {
    return empty
  }
}

function buildTripPresenter(
  badge: string,
  flat: ReturnType<typeof enrichTripRecordForSearch>,
  record: Record<string, unknown>,
): SearchResultPresenter {
  const customerLabel =
    pickString(flat.customerDisplayName, flat.contactName, flat.companyName) ?? badge
  const route =
    flat.fromAddress && flat.toAddress
      ? `${flat.fromAddress} → ${flat.toAddress}`
      : pickString(flat.fromAddress, flat.toAddress, flat.waypointAddresses)
  return {
    title: String(customerLabel),
    subtitle: formatSubtitle(
      route,
      flat.orderingPersonDisplayName,
      record.status,
      record.tripType ?? record.trip_type,
    ),
    icon: 'car',
    badge,
  }
}

async function buildTripIndexSource(ctx: SearchBuildContext): Promise<SearchIndexSource | null> {
  const { t } = await resolveTranslations()
  const badge = t('taxi_fleet.search.badge.trip', 'Trip')
  const [customer, orderingPerson] = await Promise.all([
    loadCustomerSearchEnrichment(ctx, readTripCustomerEntityId(ctx.record)),
    loadCustomerSearchEnrichment(ctx, readTripOrderingPersonId(ctx.record)),
  ])
  const flat = enrichTripRecordForSearch(ctx.record, customer, orderingPerson)
  const notes = typeof ctx.record.notes === 'string' ? ctx.record.notes : null
  const lines = buildTripSearchTextLines(flat, {
    notes,
    tripType:
      typeof ctx.record.tripType === 'string'
        ? ctx.record.tripType
        : typeof ctx.record.trip_type === 'string'
          ? ctx.record.trip_type
          : null,
    status: typeof ctx.record.status === 'string' ? ctx.record.status : null,
  })
  if (!lines.length) return null
  return {
    text: lines,
    fields: { ...flat },
    presenter: buildTripPresenter(badge, flat, ctx.record),
    checksumSource: {
      record: {
        id: ctx.record.id,
        metadata: ctx.record.metadata,
        notes: ctx.record.notes,
        customerPersonId: ctx.record.customerPersonId ?? ctx.record.customer_person_id,
        customerCompanyId: ctx.record.customerCompanyId ?? ctx.record.customer_company_id,
        orderingPersonId: ctx.record.orderingPersonId ?? ctx.record.ordering_person_id,
        status: ctx.record.status,
        tripType: ctx.record.tripType ?? ctx.record.trip_type,
      },
      customer,
      orderingPerson,
      customFields: ctx.customFields,
    },
  }
}

export const searchConfig: SearchModuleConfig = {
  entities: [
    {
      entityId: E.taxi_fleet.taxi_fleet_trip,
      enabled: true,
      priority: 8,
      buildSource: buildTripIndexSource,
      formatResult: async (ctx) => {
        const { t } = await resolveTranslations()
        const badge = t('taxi_fleet.search.badge.trip', 'Trip')
        const [customer, orderingPerson] = await Promise.all([
          loadCustomerSearchEnrichment(ctx, readTripCustomerEntityId(ctx.record)),
          loadCustomerSearchEnrichment(ctx, readTripOrderingPersonId(ctx.record)),
        ])
        const flat = enrichTripRecordForSearch(ctx.record, customer, orderingPerson)
        return buildTripPresenter(badge, flat, ctx.record)
      },
      resolveUrl: async (ctx) => {
        const id = ctx.record.id
        if (id == null) return null
        return `${TAXI_FLEET_BASE}/trips/${encodeURIComponent(String(id))}`
      },
      fieldPolicy: {
        searchable: [...TRIP_SEARCH_FIELD_POLICY_SEARCHABLE],
      },
    },
  ],
}

export default searchConfig
export const config = searchConfig
