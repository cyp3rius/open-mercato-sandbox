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

All adapters expect a **fleet partner REST API** with list-trips + OAuth (Bolt/Uber) or API key (Free). Exact vendor URLs vary by contract — configure `apiBaseUrl` per org.

| Platform | Auth | Trips endpoint (relative to `apiBaseUrl`) | Driver ID fields | Notes |
|----------|------|-------------------------------------------|------------------|-------|
| **Bolt** | OAuth2 `client_credentials` → `POST /oauth/token` | `GET /fleet/v1/orders?company_id=&start_date=&end_date=` | `driver_id`, `driver_uuid` | `companyId` setting required for multi-fleet accounts |
| **Uber** | OAuth2 `client_credentials` → `POST /oauth/token` | `GET /v1/fleet/trips?start_time=&end_time=` | `driver_id` | Scope `fleet.trips` (adapter default) |
| **Free** | Header `X-Api-Key: {clientSecret}` | `GET /api/v1/trips?from=&to=` | `driver_id` | Uses API key instead of OAuth |

### Response mapping

Vendor JSON items are normalized by `lib/platformSync/adapters/mapVendorTrip.ts`:

- Trip id → `externalTripId`
- Driver id → `platformDriverId` (must match `bolt_driver_id` / `uber_driver_id` / `free_driver_id` on driver profile)
- `paymentType` → `metadata.tripRequest.paymentType` (via upsert command)
- Default sync window: **last 26 hours** (`resolvePlatformSyncWindow.ts`)

### Operations

- **Sync now**: `POST /api/taxi_fleet/platform-sync/run` — requires enabled platform + credentials (409 otherwise)
- **CSV fallback**: `POST /api/taxi_fleet/platform-sync/import-csv`
- **Single-flight**: one `running` sync per org (409 / worker no-op)
- **429 backoff**: `fetchJsonWithRetry` in `adapters/httpClient.ts`

### Manual QA checklist

1. Configure platform credentials under **Backend → Config → Taxi fleet → Platform trip sync**
2. Set driver platform IDs on driver profiles
3. Run **Sync now** on trips list; verify sync run row + trips appear
4. Confirm secrets are masked in GET `/api/taxi_fleet/settings`
5. Wait for hourly cron (or trigger worker queue locally) and verify idempotent upsert

### Commands

| Command | Purpose |
|---------|---------|
| `taxi_fleet.platform_trip.upsert` | Idempotent trip upsert |
| `taxi_fleet.platform_sync.run` | Live adapter fetch + batch upsert |
| `taxi_fleet.platform_trip.import_csv` | CSV import fallback |
