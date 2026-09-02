# Taxi Fleet Module — Agent Guide

App module: `apps/mercato/src/modules/taxi_fleet/`

## Platform trip sync (Phase 3)

### Architecture

- Adapters: `lib/platformSync/adapters/` (`bolt`, `uber`, `free` via shared HTTP client)
- Orchestration: `lib/platformSync/executePlatformSyncRun.ts`
- Credentials: `settingsJson.platformSync.{bolt|uber|free}` on taxi fleet org settings (masked like PayPal)
- Worker: `workers/platformTripSync.ts` queue `taxi-fleet-platform-sync`
- Scheduler: `lib/platformSync/registerPlatformSyncSchedule.ts` registers hourly cron (`0 * * * *`) per org in `setup.seedDefaults`

### Partner API discovery (lock-in for adapters)

Exact vendor URLs vary by contract — configure `apiBaseUrl` per org unless a platform documents a fixed default.

| Platform | Auth | Trips / orders | Driver ID fields | Notes |
|----------|------|----------------|------------------|-------|
| **Bolt** | OAuth2 `client_credentials` → `POST https://oidc.bolt.eu/token` (scope `fleet-integration:api`); token cache refreshes ~60s before `expires_in` | Base default `https://node.bolt.eu/fleet-integration-gateway`; `POST /fleetIntegration/v1/getFleetOrders` (JSON: `company_id`/`company_ids`, `start_ts`, `end_ts`, `limit`, `offset`); smoke: `GET /fleetIntegration/v1/getCompanies` | `driver_uuid` (API); portal CSV: `Indywidualny numer identyfikacyjny` | `companyId` **required**; trip id API = `order_reference`. Live sync paginates `getFleetOrders` and maps via `mapVendorTrip.ts`. Config UI: **Test connection**. |
| **Uber** | OAuth2 `client_credentials` → `POST {apiBaseUrl}/oauth/token` | `GET /v1/fleet/trips?start_time=&end_time=` | `driver_id` / CSV: `Identyfikator UUID kierowcy` / `Driver UUID` | Scope `fleet.trips` (adapter default). **Driver gate:** only trips whose driver UUID matches `uberDriverId` on a CRM driver profile (CSV + live sync). |
| **Free** | Header `X-Api-Key: {clientSecret}` | `GET /api/v1/trips?from=&to=` | `driver_id` / CSV: `platformDriverId` | Uses API key instead of OAuth. **Driver gate:** only trips whose driver ID matches `freeDriverId` on a CRM driver profile (CSV + live sync). |

### Bolt portal CSV — „Historia przejazdów”

Fleet Owner portal export (PL headers, UTF-8, optional BOM, delimiter `,`). Fixture: `lib/platformSync/fixtures/sample-bolt-trip-history.csv`.

| Column | Maps to (future import) |
|--------|-------------------------|
| `Data` | `startedAt` |
| `Stawka sfinalizowana` | `endedAt` when non-empty |
| `Numer rejestracyjny ` (trailing space in header) | vehicle plate |
| `Trasa` | pickup / dropoff split on ` → ` |
| `Odległość\|km` | `distanceKm` |
| `Cena przejazdu\|ZŁ` | `revenueAmount` |
| `Rodzaj płatności` | `Gotówką`→cash; `W aplikacji` / `Konto Biznes`→electronic |
| `Status` | `Ukończone`→completed; reject/cancel variants→cancelled |
| `Indywidualny numer identyfikacyjny` | **`platformDriverId` (driver UUID)** — **not** a trip id |

**No per-trip order id in this export.** Idempotent CSV import must use a **synthetic** `externalTripId` (e.g. hash of `driver_uuid\|Data\|Trasa\|Cena\|Status`). Live API uses `order_reference`.

Parser: `parseBoltTripHistoryCsv` — imports **only** `Ukończone`; synthetic `externalTripId` (`boltcsv:` + hash). Generic English CSV is for Free only.

### Response mapping

Vendor JSON items are normalized by `lib/platformSync/adapters/mapVendorTrip.ts`:

- Trip id → `externalTripId`
- Driver id → `platformDriverId` (must match `bolt_driver_id` / `uber_driver_id` / `free_driver_id` on driver profile)
- **Driver gate:** before upsert (CSV and live sync), rows are filtered to drivers that exist in CRM with a non-empty platform ID (`loadKnownPlatformDriverIds` + `filterPlatformTripRowsForKnownDrivers` in `resolvePlatformDriver.ts`). Unmapped rows increment `skippedCount` and are not upserted.
- `paymentType` → `metadata.tripRequest.paymentType` (via upsert command)
- Default sync window: **manual** = last **7 days**; **scheduled (hourly cron)** = from end of last successful live sync (`succeeded`/`partial`, manual or schedule) to now, or **1 hour** if none yet (`resolvePlatformSyncWindow.ts`)

### Operations

- **Sync now**: `POST /api/taxi_fleet/platform-sync/run` — requires enabled platform + credentials (409 otherwise)
- **Test connection (Bolt)**: `POST /api/taxi_fleet/platform-sync/test-connection` `{ platform: 'bolt' }` — OIDC token + `getCompanies`
- **CSV import (async)**: `POST /api/taxi_fleet/platform-sync/import-csv` → creates run `status=queued` + `job_payload`, enqueues `taxi-fleet-platform-sync` (`kind: csv_import`), returns **202** (multiple imports may queue; no org-wide 409 lock). With `QUEUE_STRATEGY=local` (default dev), import runs **inline in the API process** and returns **201** with counts — no worker required for CSV.
- **Scheduled sync**: hourly cron no-ops while another run is `running` (not while CSV is merely `queued` after stale reclaim); stale `queued`/`running` rows auto-fail after 5 min / 2 h
- **429 backoff**: `fetchJsonWithRetry` in `adapters/httpClient.ts`

### Vehicle resolution on upsert

`lib/platformSync/resolvePlatformTripVehicle.ts` (create, or update when `resourceId` is null):

1. Match resource CF `uber_vehicle_id` / `bolt_vehicle_id` / `free_vehicle_id` (set on vehicle resources)
2. Else match normalized `vehicle_plate`
3. Else daily assignment for driver + trip date (`TaxiFleetDailyAssignment`)

### Manual QA checklist

1. Configure platform credentials under **Backend → Config → Taxi fleet → Platform trip sync**
2. Set driver platform IDs on driver profiles (and optional vehicle platform IDs / plates on resources)
3. Run **Sync now** on trips list; verify sync run row + trips appear
4. Import Uber CSV via dialog; open **History**; wait for notification when finished
5. Confirm secrets are masked in GET `/api/taxi_fleet/settings`
6. Wait for hourly cron (or trigger worker queue locally) and verify idempotent upsert

### Commands

| Command | Purpose |
|---------|---------|
| `taxi_fleet.platform_trip.upsert` | Idempotent trip upsert (`tripType: platform`) |
| `taxi_fleet.platform_sync.run` | Live adapter fetch + batch upsert |
| `taxi_fleet.platform_trip.import_csv` | Synchronous CSV import (CLI/tests); UI uses async queue |

### CSV import notes

- Bolt portal „Historia przejazdów”: dedicated parser `parseBoltTripHistoryCsv` (PL headers). Imports **only** `Status=Ukończone`. Synthetic `externalTripId` = `boltcsv:` + SHA-256 of `driverUuid|Data|Trasa|Cena|Status`. Driver profile `boltDriverId` = `Indywidualny numer identyfikacyjny`. Fixture: `fixtures/sample-bolt-trip-history.csv`.
- Free: single generic CSV (`externalTripId`, `platformDriverId`, `startedAt`, `revenueAmount`, …). Only rows whose **platformDriverId** matches a CRM profile **`freeDriverId`** are imported (same gate as live sync).
- Uber: **two** Fleet reports required — Trip Activity + Payment transactions — joined on trip UUID; revenue from payments (`Wypłacono Ci : Twój przychód`). Only rows whose **Driver UUID** matches a CRM profile **`uberDriverId`** are imported (same gate as live sync).
- Uber optional columns: pickup/dropoff addresses, vehicle UUID, license plate → trip metadata / `resourceId` resolve.
- Uber filename date ranges (`YYYYMMDD-YYYYMMDD-trip_activity|payments_order-…`) must match when both parse; otherwise import is blocked.
- Existing `platform` + `externalTripId` rows are **not** duplicated on CSV import (`createdCount` / `duplicateCount` in the run result).
- Drivers must have matching `uberDriverId` / `boltDriverId` / `freeDriverId` on the profile.
- Run history lives in the import dialog (**History**), not on the trips list page.

