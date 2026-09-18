import type {
  SearchModuleConfig,
  SearchBuildContext,
  SearchResultPresenter,
  SearchIndexSource,
} from '@open-mercato/shared/modules/search'
import type { QueryEngine } from '@open-mercato/shared/lib/query/types'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { E } from '@/.mercato/generated/entities.ids.generated'
import { TAXI_FLEET_BASE } from './backend/taxi-fleet/paths'
import {
  buildTripSearchTextLines,
  enrichTripRecordForSearch,
  readTripCustomerEntityId,
  readTripOrderingPersonId,
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

async function loadCustomerEntityDisplayName(
  ctx: SearchBuildContext,
  entityId: string | null,
): Promise<string | null> {
  if (!entityId || !ctx.queryEngine || !ctx.tenantId) return null
  const queryEngine = ctx.queryEngine as QueryEngine
  try {
    const result = await queryEngine.query(E.customers.customer_entity, {
      tenantId: ctx.tenantId,
      organizationId: ctx.organizationId ?? undefined,
      filters: { id: { $eq: entityId } },
      fields: ['id', 'display_name'],
      page: { page: 1, pageSize: 1 },
      skipAutoReindex: true,
    })
    const row = result.items[0] as Record<string, unknown> | undefined
    if (!row) return null
    return pickString(row.display_name, row.displayName)
  } catch {
    return null
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
  const [customerDisplayName, orderingPersonDisplayName] = await Promise.all([
    loadCustomerEntityDisplayName(ctx, readTripCustomerEntityId(ctx.record)),
    loadCustomerEntityDisplayName(ctx, readTripOrderingPersonId(ctx.record)),
  ])
  const flat = enrichTripRecordForSearch(ctx.record, customerDisplayName, orderingPersonDisplayName)
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
      customerDisplayName: flat.customerDisplayName,
      orderingPersonDisplayName: flat.orderingPersonDisplayName,
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
        const [customerDisplayName, orderingPersonDisplayName] = await Promise.all([
          loadCustomerEntityDisplayName(ctx, readTripCustomerEntityId(ctx.record)),
          loadCustomerEntityDisplayName(ctx, readTripOrderingPersonId(ctx.record)),
        ])
        const flat = enrichTripRecordForSearch(
          ctx.record,
          customerDisplayName,
          orderingPersonDisplayName,
        )
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
