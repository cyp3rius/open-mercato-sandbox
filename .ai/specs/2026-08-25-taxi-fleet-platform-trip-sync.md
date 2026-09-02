# Taxi Fleet — near-real-time platform trip sync (Bolt / Uber / Free)

**Date**: 2026-08-25  
**Status**: Ready for Phase 1–2 implementation (Phase 3 gated)  
**Module**: `taxi_fleet` (`apps/mercato/src/modules/taxi_fleet/`) — app module  
**Related**: `.ai/specs/2026-07-03-taxi-fleet-module.md`, `.ai/specs/2026-08-20-taxi-fleet-receipt-ocr.md`, `.ai/specs/analysis/ANALYSIS-2026-08-25-taxi-fleet-platform-trip-sync.md`

## TLDR

**Key Points:**
- Near-real-time ingest of marketplace trips (**Bolt, Uber, Free**) into CRM as `TaxiFleetTrip` records.
- Primary transport: **partner/fleet APIs**; **CSV import** uses the same upsert path as fallback.
- Settlements keep consuming week trips (`generate` / recalculate / „Odśwież kursy”). **Payout reconciliation stays outside CRM** (ops Excel/bank — not this work).
- Drivers appear in **backend CRM** and **driver PWA trip list** (synced trips read-only in PWA).

**Scope:**
- Durable `platform` + `external_trip_id` on trips; platform driver IDs on driver profiles.
- Adapter interface for Bolt / Uber / Free + org-scoped API credentials.
- Commands: upsert trip, run sync, import CSV; scheduler every **60 minutes** + **Sync now**.
- Optional customer on synced platform trips; no income-receipt requirement (existing platform rules).
- After successful sync: refresh open (unlocked) weekly settlements for affected drivers/weeks.

**Out of scope:**
- Uber/Bolt/Free **payout** file ↔ bank transfer matching in CRM.
- Webhooks as primary ingest (upsert contract must stay webhook-ready later).
- Changing settlement revenue formulas beyond consuming synced trips.
- Auto-creating driver profiles from platform accounts.

**Concerns:**
- Partner API availability/contracts differ per market; CSV must remain first-class.
- Driver ID mapping must be filled on profiles before trips can attach to a driver.
- Conflict policy when CRM trip was manually edited after sync.

## Decisions (resolved)

| Q | Decision |
|---|----------|
| Q1 | Ship **all three** platforms (`bolt`, `uber`, `free`) behind one adapter contract. |
| Q2 | **Partner/fleet APIs** as primary + **CSV import** as fallback on the same upsert. |
| Q3 | Store platform driver identifiers on **driver profile** (standard fleet pattern). Exact ID field names per vendor documented in adapter; ops paste IDs from company fleet console. |
| Q4 | Synced platform trips: **`customer_*` optional** (no placeholder company). Manual own-fleet trips keep existing customer rules. |
| Q5 | Visible in **CRM + driver PWA** (PWA: list/detail read-only for `source=platform_sync`). |
| Q6 | **Sync now** + cron every **60 minutes**. |

### Pre-implement lock-ins (2026-08-25 analysis)

| Topic | Decision |
|-------|----------|
| Customer validation | **Do not** loosen public `tripCreateSchema` / `tripUpdateSchema`. Optional customer only on dedicated upsert/import command path. |
| `tripType` | Synced trips use **`tripType: 'platform'`** (dedicated enum; no customer required). Settlement revenue still counts by `status` + `revenueAmount` + `platform`. |
| Payment type storage | Write **`metadata.tripRequest.paymentType`** (what `readTripPaymentType` reads). Do **not** put payment type only at `metadata.paymentType`. |
| Import command id | `taxi_fleet.platform_trip.import_csv` (singular). |
| Events | Declare **before emit**: `taxi_fleet.trip.updated`, `taxi_fleet.platform_sync.completed` in `events.ts`. |
| Scheduler | Phase 3: seed/register a system `scheduled_jobs` row (interval 60m) targeting queue worker that fans out per org with `platformSync.*.enabled`. |
| Concurrent runs | One active run per `(tenant, org)` — second Sync now / cron returns 409 or no-ops while `status=running`. |

---

## Overview

Operators and drivers need marketplace trips in CRM without waiting for weekly settlement prep. This feature polls partner APIs (and accepts CSV) to upsert completed/cancelled trips onto the existing `taxi_fleet_trips` model, keyed by platform external ID and mapped to a driver via profile platform IDs.

Weekly settlements remain the aggregation layer: once trips exist, generate/recalc/„Odśwież kursy” already produce revenue breakdown lines (`uber_platform`, `bolt_platform`, `free`, `uber_cash`, …).

> **Market Reference**: Fleet/TMS products (e.g. Cabify fleet tools, generic ride-hailing partner portals) treat **trip ingest** and **payout reconciliation** as separate products. We adopt trip ingest + driver ID mapping + idempotent external IDs; we reject in-CRM payout matching (explicitly deferred to ops outside CRM).

## Problem Statement

- `platform` exists on trips, but ingest is manual only — CRM under-reports Bolt/Uber/Free volume.
- Strapi `trips.inject` covers own-fleet booking requests, not marketplace trips, and idempotency via `metadata.requestId` scan does not scale.
- Settlements and „Odśwież kursy” already assume trips exist; the gap is getting marketplace trips into CRM in near real time.
- Payout Excel workflows will stay outside CRM; duplicating them here adds scope without value for this team.

## Proposed Solution

1. **Identity**
   - Trip: columns `external_trip_id` + existing `platform` (unique per tenant/org when both set).
   - Driver profile: `bolt_driver_id`, `uber_driver_id`, `free_driver_id` (nullable text).
2. **Normalize** — each adapter maps vendor payload → `PlatformTripDto`.
3. **Upsert** — command `taxi_fleet.platform_trip.upsert` creates/updates `TaxiFleetTrip` (`tripType: 'platform'`, no customer required) with `team_member_id` resolved from profile IDs; status `completed` / `cancelled` / `paid` as mapped. Public trip CRUD schemas stay unchanged.
4. **Sync run** — `taxi_fleet.platform_sync.run` for one or all platforms; records a sync-run row (counts, errors); single-flight per org.
5. **CSV** — same DTO + `taxi_fleet.platform_trip.import_csv`; column mapping validated with zod (see CSV contract).
6. **Schedule** — UI **Sync now** (Phase 2); Phase 3: `scheduled_jobs` every 60 minutes → worker fans out orgs with enabled credentials.
7. **Settlement hook** — after successful upserts, `recalculateWeeklySettlementIfExists` for unlocked weeks touched by synced trips.
8. **PWA** — driver lists already filter by `team_member_id`; synced trips appear automatically; mutations blocked when `metadata.ingestSource` is `platform_sync` or `platform_csv` (trips + driver cost-line routes).

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| Trips table, not settlement-only import | One source of truth for CRM list, PWA, distance, revenue, recalc |
| Real `external_trip_id` column + unique index | Replaces weak metadata scan used by Strapi inject for platform volume |
| IDs on driver profile | Standard fleet console pattern; no auto-provision of staff |
| Customer optional for platform sync only | Marketplace riders are not CRM customers; income receipt already exempt |
| API + CSV same upsert | CSV remains viable when API keys/markets lag |
| Payouts out of CRM | Explicit product boundary |
| Soft conflict policy | Platform wins on revenue/status/times unless operator locked fields (see Conflicts) |
| `tripType: 'platform'` for sync | Dedicated type for marketplace ingest; avoids `client` + customer-required zod path |
| Payment under `tripRequest` | Matches existing settlement classifier (`readTripPaymentType`) |
| Dedicated upsert validators | Keeps public create/update API contract stable (BC) |

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Weekly CSV-only into settlement snapshot | Breaks CRM/PWA visibility; duplicates trip model |
| Webhooks-first | Partner webhook access uneven; harder ops; same upsert can add later |
| Placeholder CRM company per platform | Noise in customers module; optional customer is enough |
| Auto-create drivers from API | Dangerous (wrong staff link); ops must map IDs deliberately |

## User Stories / Use Cases

- **Operator** wants marketplace trips in CRM within ~1 hour so the trip list and open settlements stay current.
- **Operator** wants to paste Bolt/Uber/Free driver IDs on the driver profile so sync can attach trips.
- **Operator** wants **Sync now** after a busy shift without waiting for cron.
- **Operator** wants CSV upload when API is down or for a historical week backfill.
- **Driver** wants to see Bolt/Uber/Free trips in PWA (read-only) alongside own-fleet trips.
- **System** wants idempotent re-sync (no duplicate trips) and safe recalc of open weekly settlements.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐
│ Bolt / Uber /   │     │ CSV upload       │
│ Free fleet API  │     │ (fallback)       │
└────────┬────────┘     └────────┬─────────┘
         │                       │
         ▼                       ▼
   PlatformTripAdapter     CsvPlatformTripParser
         │                       │
         └──────────┬────────────┘
                    ▼
         PlatformTripDto (zod)
                    ▼
     taxi_fleet.platform_trip.upsert
                    ▼
         TaxiFleetTrip (+ external_trip_id)
                    │
         ┌──────────┼──────────┐
         ▼          ▼          ▼
   CRM trips   Driver PWA   Weekly settlement
   list/detail  (read-only)  recalc if unlocked
```

### Placement

- All code in `apps/mercato/src/modules/taxi_fleet/` (app module).
- Adapters: `lib/platformSync/adapters/{bolt,uber,free}.ts` + `types.ts`.
- Credentials: extend `taxiFleetSettingsSchema` / `settingsJson.platformSync.*` with PayPal-style mask + `*Configured` flags — no secrets in trip metadata/logs.
- Worker: `workers/platformTripSync.ts` with auto-discovery `metadata: { queue, id?, concurrency? }`.
- Scheduler (Phase 3): system `scheduled_jobs` (scope tenant/org or global tick) → enqueue worker; worker loads orgs where any `platformSync.{bolt|uber|free}.enabled` and credentials configured, then runs `taxi_fleet.platform_sync.run` per org (sequential or low concurrency).

### Commands & Events

| Command | Purpose | Undo |
|---------|---------|------|
| `taxi_fleet.platform_trip.upsert` | Create/update one trip from DTO | Soft-delete created trip; restore previous field snapshot for update; use `extractUndoPayload` from `@open-mercato/shared/lib/commands`; fork EM in `buildLog` |
| `taxi_fleet.platform_sync.run` | Fetch via adapter(s) → batch upsert | Compound: per-item upsert undo payloads; sync-run row kept as audit |
| `taxi_fleet.platform_trip.import_csv` | Parse CSV → batch upsert | Same compound undo per trip |
| `taxi_fleet.driver_profiles.update` (extend) | Save platform driver IDs | Existing profile update undo |

| Event | When | Notes |
|-------|------|-------|
| `taxi_fleet.trip.created` | New synced trip | Existing; payload additive only |
| `taxi_fleet.trip.updated` | Upsert changed fields | **Declare in `events.ts` before first emit** (new additive ID) |
| `taxi_fleet.platform_sync.completed` | Sync/CSV run finished | **Declare in `events.ts`**; optional `clientBroadcast: true`; payload: counts, platform, runId |

### Conflicts & field ownership

For trips with `metadata.ingestSource` in `platform_sync` | `platform_csv`:

| Field | Sync may overwrite | Notes |
|-------|-------------------|-------|
| `status`, `started_at`, `ended_at`, `distance_km`, `revenue_amount`, `platform`, `currency_code`, `trip_type` (keep `other`) | Yes | Source of truth = platform |
| `metadata.tripRequest.paymentType` | Yes | Required for `uber_cash` vs `uber_platform` |
| `team_member_id` | Only if currently null or still matches mapping | If operator reassigned to another driver, skip overwrite and flag conflict on sync run |
| `customer_*`, `notes`, assignment/resource | No | Operator-owned |
| Manual own-fleet trips (`platform` null / no external id) | N/A | Sync never touches them |

Unmapped platform driver ID → trip upsert **skipped** + sync-run error/skip row. **MVP: skip + log** until profile ID is set, then next sync attaches. UI should surface `skipped_count` with hint to fill driver platform IDs.

### Settlement hook

After a sync/CSV run that upserted ≥1 trip:

- Collect distinct `(teamMemberId, weekStart)` from touched trips.
- For each: `recalculateWeeklySettlementIfExists` (no-op if missing or locked).

No automatic settlement **generate** — operator still generates the weekly draft.

## Data Models

### TaxiFleetTrip (extend)

Additive columns:

| Column | Type | Notes |
|--------|------|-------|
| `external_trip_id` | text, nullable | Vendor trip id; required when ingestSource=platform_sync |
| *(existing)* `platform` | uber \| bolt \| free \| null | Required for synced trips |

Constraints / indexes:

- Unique: `(tenant_id, organization_id, platform, external_trip_id)` where `external_trip_id IS NOT NULL` (partial unique index).
- Index: `(tenant_id, organization_id, platform, started_at)` for sync windows.

Metadata (JSON, additive) — upsert MUST merge:

```ts
{
  ingestSource: 'platform_sync' | 'platform_csv'
  platformDriverId?: string
  lastSyncedAt?: string // ISO
  rawExternalStatus?: string
  // Settlement classifier reads payment via tripRequestDetailsFromMetadata:
  tripRequest: {
    paymentType: 'cash' | 'card' | 'electronic' | 'transfer' | 'other'
    // other tripRequest fields may be empty defaults
  }
}
```

**MUST NOT** store payment type only at top-level `metadata.paymentType` — `readTripPaymentType` ignores it.

### TaxiFleetDriverProfile (extend)

| Column | Type | Notes |
|--------|------|-------|
| `bolt_driver_id` | text, nullable | ID from Bolt company fleet console |
| `uber_driver_id` | text, nullable | ID from Uber fleet / partner portal |
| `free_driver_id` | text, nullable | ID from Free fleet console |

Unique (partial) per org recommended: `(tenant_id, organization_id, bolt_driver_id)` when not null — same for uber/free — to prevent two CRM drivers claiming one platform ID.

### TaxiFleetPlatformSyncRun (new)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` / `organization_id` | uuid | required |
| `platform` | uber \| bolt \| free \| `all` | |
| `trigger` | `schedule` \| `manual` \| `csv` | |
| `status` | `running` \| `succeeded` \| `failed` \| `partial` | |
| `started_at` / `finished_at` | timestamptz | |
| `fetched_count` / `upserted_count` / `skipped_count` / `error_count` | int | |
| `window_from` / `window_to` | timestamptz, nullable | API lookback window |
| `error_summary` | text/json, nullable | No secrets |
| `created_at` / `updated_at` | | |
| `deleted_at` | nullable | soft delete optional |

### PlatformTripDto (zod, shared)

Lives in `data/validators.ts`. Used only by upsert/import/adapters — **not** by public `tripCreateSchema`.

```ts
{
  platform: 'uber' | 'bolt' | 'free'
  externalTripId: string
  platformDriverId: string
  status: 'completed' | 'cancelled' | 'paid' // mapped from vendor
  startedAt: string // ISO
  endedAt?: string | null
  distanceKm?: number | null
  revenueAmount: number // gross for settlement; currency PLN default
  currencyCode?: string
  paymentType?: 'cash' | 'card' | 'electronic' | null // → metadata.tripRequest.paymentType; default 'electronic' if omitted for uber/bolt/free
  raw?: Record<string, unknown> // optional, strip PII beyond need; do not store card PANs
}
```

Upsert persistence defaults:

- `tripType`: `'other'`
- `customerPersonId` / `customerCompanyId`: `null`
- `externalTripId` + `platform` required
- Public `tripCreateSchema` / `tripUpdateSchema` **unchanged** (client trips still require customer)

### CSV contract

- Encoding: UTF-8; delimiter `,` (optional `;` if single-column parse fails).
- Max file size: **5 MiB**; max rows: **5_000** per import (chunk upserts of 100).
- Content-Type: `text/csv` / `text/plain` / `application/vnd.ms-excel` (text parse only).
- `platform` query/form field required (all rows inherit that platform); column `platform` if present must match or row errors.
- Sample fixture: `apps/mercato/src/modules/taxi_fleet/lib/platformSync/fixtures/sample-platform-trips.csv` (Phase 2).

| Header | Required | Notes |
|--------|----------|-------|
| `externalTripId` | yes | Vendor trip id |
| `platformDriverId` | yes | Maps to profile `*_driver_id` |
| `startedAt` | yes | ISO-8601 or `YYYY-MM-DD HH:mm` |
| `revenueAmount` | yes | Decimal, `.` or `,` |
| `status` | no | Default `completed`; allow `completed`/`cancelled`/`paid` |
| `endedAt` | no | |
| `distanceKm` | no | |
| `paymentType` | no | `cash`/`card`/`electronic`; default `electronic` |
| `currencyCode` | no | Default `PLN` |

Row errors collected in sync-run `error_summary` (no abort of whole file unless headers invalid).

#### Bolt portal CSV — „Historia przejazdów” (native export)

Fleet Owner portal export (PL headers; UTF-8 with optional BOM; delimiter `,`). Fixture: `fixtures/sample-bolt-trip-history.csv`. Parser: `parseBoltTripHistoryCsv` — **only** `Status=Ukończone` → `completed`; other statuses skipped.

| Portal column | Target (future) | Notes |
|---------------|-----------------|-------|
| `Data` | `startedAt` | `YYYY-MM-DD HH:mm` |
| `Stawka sfinalizowana` | `endedAt` | Empty on non-completed rows |
| `Kierowca` | metadata | Display name |
| `Numer rejestracyjny ` | vehicle plate | **Trailing space in header** |
| `Model samochodu` | metadata | |
| `Trasa` | pickup / dropoff | Split on ` → ` |
| `Przybycie do miejsca odbioru` / `…docelowego` | times | `HH:mm` on `Data` day |
| `Odległość\|km` | `distanceKm` | |
| `Cena przejazdu\|ZŁ` | `revenueAmount` | |
| `Rodzaj płatności` | `paymentType` | `Gotówką`→cash; `W aplikacji` / `Konto Biznes`→electronic |
| `Status` | status | **Only** `Ukończone` imported → `completed`; other statuses skipped |
| `Indywidualny numer identyfikacyjny` | `platformDriverId` | Driver UUID — **not** trip id |
| `Telefon` / `Kategoria` / `Typ` / fees / tips | metadata | Do not log phones |

**Decision:** portal CSV has **no** `order_reference`. Synthetic `externalTripId` = stable hash of `driver_uuid|Data|Trasa|Cena przejazdu|Status`. Live API uses `order_reference`.

### Org credentials (settings)

Store under taxi fleet org settings (encrypted at rest per platform encryption helpers):

- `platformSync.bolt` / `.uber` / `.free`: `{ enabled, apiBaseUrl?, clientId?, clientSecret?, refreshToken?, companyId?, ... }`
- **Bolt configured when**: `enabled` + `clientId` + `clientSecret` + `companyId` (`apiBaseUrl` optional; default `https://node.bolt.eu/fleet-integration-gateway`). OIDC token URL is fixed (`https://oidc.bolt.eu/token`, scope `fleet-integration:api`); refresh-token field unused for Bolt.
- Secrets never returned on GET settings without mask; never logged.

Exact OAuth/API shapes are adapter-private; settings UI exposes only fields each adapter declares. Bolt: **Test connection** button → `POST .../test-connection`.

### Bolt Fleet Integration Gateway (live lock-in)

Docs: [fleetIntegrationGatewayAuth](https://apidocs.bolt.eu/fleetIntegration/fleetIntegrationGatewayAuth/).

| Concern | Value |
|---------|-------|
| Token | `POST https://oidc.bolt.eu/token` (`client_credentials`, scope `fleet-integration:api`); cache + refresh ~60s before expiry |
| API base | `https://node.bolt.eu/fleet-integration-gateway` (override via `apiBaseUrl`) |
| Orders | `POST /fleetIntegration/v1/getFleetOrders` |
| Smoke | `GET /fleetIntegration/v1/getCompanies`; optional `POST /fleetIntegration/v1/test` |
| Trip id | `order_reference` |
| Driver id | `driver_uuid` |

CRM trip mapping from `FleetOrder` is **not** shipped yet; Sync now may authenticate/fetch and report “mapping not implemented”.

## API Contracts

All routes: `requireAuth` + feature guards; filter by `organization_id` / tenant from session. Export `openApi`. Zod on body/query.

### POST `/api/taxi_fleet/platform-sync/run`

- **Feature**: `taxi_fleet.manage_platform_sync` (new).
- **`setup.ts` `defaultRoleFeatures`**: grant to roles that already get `taxi_fleet.manage_trips` (e.g. `employee`); `admin` keeps `taxi_fleet.*`. Driver role: **no** grant.
- **Body**: `{ platforms?: ('uber'|'bolt'|'free')[], windowFrom?: string, windowTo?: string }`
- **Response**: `{ runId, status, fetchedCount, upsertedCount, skippedCount, errorCount }`
- **Errors**: 400 validation; 409 no credentials **or** sync already running for org; 502 adapter upstream (mapped, no secret leak)

### POST `/api/taxi_fleet/platform-sync/test-connection`

- **Feature**: `taxi_fleet.manage_platform_sync`
- **Body**: `{ platform: 'bolt' }` (only Bolt in this iteration)
- **Response**: `{ ok: true, platform, apiBaseUrl, companyCount, companyIdMatched }`
- **Errors**: 409 credentials incomplete; 4xx/5xx upstream mapped without leaking secrets

### POST `/api/taxi_fleet/platform-sync/import-csv`

- **Feature**: `taxi_fleet.manage_platform_sync`
- **Body**: multipart file + `platform` (required); headers per CSV contract
- **Response**: same shape as run (`trigger=csv`)
- **Errors**: 400 bad CSV / missing columns / over size or row limit; row-level errors in run summary

### GET `/api/taxi_fleet/platform-sync/runs`

- **Feature**: `taxi_fleet.view` or `taxi_fleet.manage_platform_sync`
- **Query**: `page`, `pageSize` (≤100), `platform?`, `status?`
- **Response**: paginated sync runs (no raw credentials)

### Driver profile CRUD (extend)

- Accept/return `boltDriverId`, `uberDriverId`, `freeDriverId` on create/update/get.
- UI: driver detail + create form fields + i18n help text (“paste ID from fleet console”).

### Trip list filters (extend)

- Backend + driver list: filter `platform`, `ingestSource` (optional).
- Driver PWA: no create/edit/delete for platform-synced trips; also block **driver trip cost** mutate routes for those trips (API **403**).

### Existing settlement APIs

- Unchanged. Recalc triggered internally after sync.
- Public trip create/update/delete APIs: **unchanged** contracts.

## UI

| Surface | Change |
|---------|--------|
| `/backend/taxi-fleet/drivers/[id]` | Platform ID fields (Bolt / Uber / Free) |
| `/backend/taxi-fleet/trips` | Badge/source for platform sync; filters; **Sync now** + **Import CSV** in header actions (`Button`/`IconButton`, `type="button"`) |
| `/backend/taxi-fleet/trips/[id]` | Read-only notice when ingestSource is platform; show external id |
| Config / settings taxi-fleet | Per-platform sync enabled + credential fields (masked like PayPal) |
| Sync runs (simple panel or sub-page) | Last runs, counts, errors, skipped (missing driver IDs) |
| Import CSV dialog | Cmd/Ctrl+Enter submit, Escape cancel |
| `/driver/trips` | Show platform trips; hide edit/complete/cost actions for synced rows |

i18n: all labels/errors in `en.json` / `pl.json` under `taxi_fleet.platformSync.*` and driver profile keys. Feature-gated UI uses wildcard-aware `hasFeature` (not exact `includes`).

## Phasing

### Phase 1 — Foundation + upsert + profile IDs

1. Migration: `external_trip_id`, profile platform ID columns, unique indexes, `taxi_fleet_platform_sync_runs`.
2. Declare events `taxi_fleet.trip.updated`, `taxi_fleet.platform_sync.completed`; ACL `manage_platform_sync` + setup grants.
3. Zod `PlatformTripDto` + `taxi_fleet.platform_trip.upsert` (`tripType: 'platform'`, customer null, payment → `metadata.tripRequest.paymentType`, undo via `extractUndoPayload`).
4. Driver profile API/UI for three IDs.
5. Unit tests: upsert idempotency, mapping, skip unmapped driver, paymentType → tripRequest, **manual create still requires customer**.

**Exit**: Manual upsert via internal command/test fixture creates visible CRM trip.

### Phase 2 — CSV + Sync now + PWA read-only

1. CSV parser per contract + `taxi_fleet.platform_trip.import_csv` + UI dialog (Cmd+Enter).
2. `platform_sync.run` orchestration + sync run persistence + single-flight lock (adapters may stub empty until Phase 3).
3. Sync now button; PWA read-only guards (trips + costs); trip badges; skipped_count UX.
4. Settlement recalc hook after run.
5. Integration tests: CSV → trip → weekly recalc picks up revenue line (incl. uber cash when paymentType=cash).

**Exit**: Operator can CSV-import a week of Bolt trips and see them in CRM/PWA/settlement refresh.

### Phase 3 — Live adapters + scheduler

**Gate**: short API discovery spike per vendor (auth, trip list endpoint, driver id field) documented in module `AGENTS.md` before coding adapters.

1. Implement Bolt, Uber, Free adapters against partner APIs (feature-flag per platform `enabled`).
2. Credential settings UI + encryption/masking.
3. Register 60‑minute `scheduled_jobs` + worker fan-out per enabled org; 429 backoff; single-flight.
4. Partial failure handling (`status=partial`), retries without duplicating trips.
5. Docs: how to obtain driver IDs and API credentials.

**Exit**: Sync now + hourly cron fetch real trips for each enabled platform.

## Implementation Plan (steps)

### Phase 1

1. Add entities/validators/migration; run `yarn db:generate` / migrate.
2. Declare events; implement upsert command; ACL feature + setup defaults; `yarn generate`.
3. Wire profile fields through commands/API/forms/i18n.
4. Keep public trip validators unchanged; upsert schema separate.
5. Tests for unique external id, conflict skip, tripRequest paymentType, customer still required on manual create.

### Phase 2

1. CSV column contract in OpenAPI + sample fixture file.
2. Import API + UI dialog (`Button`, Cmd+Enter / Escape).
3. Sync run entity + list panel; single-flight.
4. Driver trip + cost mutate guards for platform ingestSource.
5. Call `recalculateWeeklySettlementIfExists` / `recalculateWeeklySettlementsForTrip` post-run.
6. Integration coverage per `.ai/qa/AGENTS.md` for import + list visibility.

### Phase 3

1. Per-vendor API spike notes in module `AGENTS.md`.
2. Adapter interface: `fetchTrips({ window, credentials }) => PlatformTripDto[]`.
3. Per-vendor auth + pagination; map statuses/payment types → DTO.
4. `scheduled_jobs` registration + worker fan-out; observability via sync runs only (no PII/secrets in logs).
5. Manual QA checklist with sandbox credentials.

## Security

- Zod on all inputs in `data/validators.ts`; parameterized ORM queries.
- **MUST** use `findWithDecryption` / `findOneWithDecryption` with `tenantId` + `organizationId` on trip, profile, sync-run, and settings reads.
- Features: `taxi_fleet.manage_platform_sync` for run/CSV; `taxi_fleet.view` / `manage_trips` for viewing; driver feature cannot run sync; UI/`hasFeature` wildcard-aware.
- Secrets masked in API (PayPal pattern); never in sync `error_summary` or trip `metadata.raw` beyond non-sensitive ids.
- CSV: size/row limits; reject executable content types; parse as text only.
- XSS: render platform notes/ids as text (existing UI primitives).

## Performance & Cache

- Upsert by unique `(platform, external_trip_id)` — no full-table metadata scan.
- Sync window default: last **26 hours** lookback on hourly cron (overlap for late events); CSV max **5_000** rows/run, chunked by 100.
- Batch upsert flush EM per chunk.
- Single-flight sync per org (avoid overlapping cron + Sync now).
- No cache required for MVP; if trip list cached later, invalidate tenant/org trip tags on sync completed.
- Sync runs list: offset OK while pageSize ≤100 for MVP.

## Migration & Backward Compatibility

- Additive DB columns/table only; existing trips keep `external_trip_id` null.
- **Public trip create/update/delete request/response contracts unchanged** (customer rules for `client` trips unchanged).
- Settlement API URLs and response shapes unchanged; only underlying trip volume grows.
- Strapi `trips.inject` unchanged (still metadata `requestId`); optional follow-up to migrate inject to `external_trip_id` — **not required**.
- Event IDs: existing unchanged; **new** `taxi_fleet.trip.updated` and `taxi_fleet.platform_sync.completed` (declare before emit).
- ACL: new feature additive; setup grants for employee; admin wildcard covers it.
- No renames/removals → deprecation protocol N/A.

## Risks & Impact Review

| Risk | Severity | Area | Mitigation | Residual |
|------|----------|------|------------|----------|
| Partner API unavailable / contract change | High | Sync | CSV fallback; per-platform enable flag; adapter isolation | Ops must keep CSV process |
| Wrong/missing driver ID mapping | High | Data quality | Skip unmapped; unique profile IDs; UI help | Trips delayed until mapped |
| Duplicate trips if unique index missing | High | Data | Partial unique index + upsert by key | None if migration applied |
| Wrong paymentType metadata shape | High | Settlements | MUST write `metadata.tripRequest.paymentType` | — |
| Concurrent Sync now + cron | Medium | Sync | Single-flight per org (409 / no-op) | Rare race if lock weak |
| Secret leakage in logs/errors | High | Security | Mask credentials; strip raw payloads | Adapter bugs — code review |
| Cron load / rate limits | Medium | Perf | 60 min cadence; window overlap; backoff on 429 | Large fleets may need per-driver fetch later |
| PWA driver confused by read-only trips | Low | UX | Badge + disabled actions + i18n hint | — |
| Settlement locked while sync updates trips | Low | Settlements | Recalc skips locked; next unlock refresh | Approved week may need manual reopen policy (existing) |

## Testing Strategy

- **Unit**: DTO zod, status/payment mapping, upsert idempotency, unmapped skip, CSV header validation.
- **Integration**: CSV import → GET trips as operator + as driver; sync run row; unlocked settlement recalc includes platform revenue line; locked settlement not rewritten.
- **Manual**: credentials in settings; Sync now; verify no secrets in network responses.

### Integration coverage (required)

| Path | Assertion |
|------|-----------|
| `POST .../platform-sync/import-csv` | Creates trips with external ids; second import no dupes |
| `GET /api/taxi_fleet/trips` | Operator sees platform trips |
| `GET /api/taxi_fleet/driver/trips` | Driver sees own mapped trips; mutate returns 403 |
| Settlement generate/recalc | Revenue breakdown includes platform lines; `paymentType=cash` + uber → `uber_cash` |

## Final Compliance Report — 2026-08-25

### AGENTS.md Files Reviewed

- `AGENTS.md` (root) — Task Router: Module Development, API, ACL, Events, Queue/workers, taxi_fleet module context via app module
- `packages/core/AGENTS.md` — API openApi, commands, setup role features
- `packages/shared/AGENTS.md` — i18n, zod, encryption helpers (credentials)
- `packages/ui/AGENTS.md` — backend forms/tables patterns (referenced for UI)
- `packages/queue/AGENTS.md` — worker idempotency (scheduler)
- `.ai/specs/AGENTS.md` — naming, required sections
- Related product specs: `2026-07-03-taxi-fleet-module.md`, `2026-08-20-taxi-fleet-receipt-ocr.md`

### Compliance Matrix

| Rule Source | Rule | Status | Notes |
|-------------|------|--------|-------|
| root AGENTS.md | No cross-module ORM relations | Compliant | FK IDs only (`team_member_id`, customers optional) |
| root AGENTS.md | Filter by `organization_id` | Compliant | All queries scoped |
| root AGENTS.md | Zod validators | Compliant | DTO + API bodies |
| root AGENTS.md | Commands for writes | Compliant | upsert / run / import_csv |
| root AGENTS.md | Event naming `module.entity.action` | Compliant | `trip.updated`, `platform_sync.completed` |
| root AGENTS.md | Singular entity naming | Compliant | `platform_trip.upsert` / `import_csv` |
| root AGENTS.md | Additive DB only | Compliant | New columns + new table |
| root AGENTS.md | ACL feature IDs frozen once shipped | Compliant | New additive feature |
| packages/core/AGENTS.md | `openApi` on routes | Compliant | Declared in API section |
| packages/core/AGENTS.md | `defaultRoleFeatures` with new features | Compliant | Phase 1 setup for employee |
| packages/shared | `extractUndoPayload` / fork EM in `buildLog` | Compliant | Documented on upsert command |
| packages/queue/AGENTS.md | Idempotent workers | Compliant | Upsert by external id |
| packages/scheduler | 60m job via `scheduled_jobs` + worker fan-out | Compliant | Phase 3 |
| BACKWARD_COMPATIBILITY | Contract surfaces | Compliant | Additive APIs/events/columns; public trip CRUD unchanged; inject unchanged |

### Gaps / Follow-ups

- Bolt/Uber/Free **CRM trip mapping** from live payloads: Bolt Gateway auth + client shipped; `FleetOrder` → `PlatformTripDto` still a follow-up. Bolt portal CSV parser shipped (`parseBoltTripHistoryCsv`).
- Optional later: migrate Strapi inject idempotency to `external_trip_id` (out of scope).

### Verdict

**Ready for Phase 1–2 implementation** after pre-implement lock-ins (2026-08-25). Phase 3 remains gated on API spikes + scheduler wiring.

### Review — 2026-08-25

- **Reviewer**: Agent
- **Security**: Passed (secrets masking, ACL, tenant scope, findWithDecryption)
- **Performance**: Passed (indexes, chunking, lookback, single-flight)
- **Cache**: Passed (N/A MVP; invalidation noted if introduced)
- **Commands**: Passed (upsert + compound runs + extractUndoPayload)
- **Risks**: Passed
- **Verdict**: Approved (with lock-ins applied)

### Review — 2026-08-25 (pre-implement remediation)

- **Reviewer**: Agent
- **Source**: `.ai/specs/analysis/ANALYSIS-2026-08-25-taxi-fleet-platform-trip-sync.md`
- **Applied**: paymentType → `tripRequest`; dedicated upsert path; `tripType: 'other'`; CSV contract; events declare-before-emit; singular import command; scheduler fan-out; findWithDecryption; PWA cost guard; ACL grants
- **Verdict**: Spec gaps closed for Phase 1–2

## Changelog

| Date | Change |
|------|--------|
| 2026-08-25 | Skeleton + open questions. |
| 2026-08-25 | Full spec after Q1–Q6: all three platforms; API+CSV; profile driver IDs; optional customer; CRM+PWA; Sync now + 60 min cron; payouts explicitly out of scope. |
| 2026-08-25 | Pre-implement remediation: tripRequest.paymentType, tripType other, no public schema loosen, CSV headers, events, singular import_csv, scheduler/single-flight, security/undo/ACL details. |
| 2026-08-29 | UX follow-up: `tripType: platform`; async CSV import (`queued` + `job_payload`); Uber addresses/vehicle columns + resource CF IDs; filename date-range check; ingest sidebar vs OCR; History in import dialog. |
| 2026-09-01 | Bolt Fleet Integration Gateway lock-in (OIDC `oidc.bolt.eu`, scope `fleet-integration:api`, base `node.bolt.eu/fleet-integration-gateway`); portal CSV „Historia przejazdów” contract + fixture; test-connection API; trip mapping deferred. |
| 2026-09-01 | Bolt CSV: `parseBoltTripHistoryCsv` (only Ukończone; synthetic `boltcsv:` external ids); wired into async import + UI hints. |
