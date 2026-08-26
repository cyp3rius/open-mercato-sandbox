# Pre-Implementation Analysis: Taxi Fleet — platform trip sync (Bolt / Uber / Free)

**Spec**: `.ai/specs/2026-08-25-taxi-fleet-platform-trip-sync.md`  
**Date**: 2026-08-25  
**Analyst**: Agent (pre-implement-spec skill)

## Executive Summary

The spec is directionally sound and mostly **additive** (new columns, table, APIs, ACL feature, events). There are **no Critical BC violations** against the 13 contract surfaces. Implementation is **blocked on a few spec gaps** that would cause wrong settlement classification or break existing trip validators: payment-type metadata shape, explicit customer/tripType exemption for upsert, declaration of `taxi_fleet.trip.updated`, CSV column contract, and how the 60‑minute schedule is registered (platform `scheduler` jobs vs ad‑hoc worker).

**Recommendation**: **Needs spec updates first** (small, targeted), then Phase 1–2 are ready to code. Phase 3 (live partner APIs) remains research-bound and should stay gated.

## Backward Compatibility

### Violations Found

| # | Surface | Issue | Severity | Proposed Fix |
|---|---------|-------|----------|-------------|
| 1 | 8 Database schema | Spec adds columns/table only — compliant | — | Proceed with entity edits + `yarn db:generate` |
| 2 | 7 API route URLs | New routes only; no renames | — | Keep inject `/api/taxi_fleet/trips/inject` untouched |
| 3 | 5 Event IDs | Spec emits `taxi_fleet.trip.updated` which is **not declared** today; adding it is allowed (additive) | Warning | Declare in `events.ts` **before** first emit; do not rename existing trip lifecycle IDs |
| 4 | 10 ACL feature IDs | New `taxi_fleet.manage_platform_sync` | — | Additive; wire `setup.ts` `defaultRoleFeatures` for operator/employee as appropriate; `admin` already has `taxi_fleet.*` |
| 5 | 2 Type / validators | Broadly relaxing `tripCreateSchema` customer rule for all `client` trips would change API behavior for existing clients | Warning | **Do not** loosen global create schema. Add dedicated upsert/import schema + command path; keep manual `client` customer-required |
| 6 | 1 Auto-discovery | New `workers/platformTripSync.ts` is additive convention use | — | Export `metadata: { queue, id?, concurrency? }` per frozen worker contract |
| 7 | Naming (commands) | `taxi_fleet.platform_trips.import_csv` uses plural `trips` | Warning | Prefer `taxi_fleet.platform_trip.import_csv` (singular entity) for AGENTS consistency |

### Missing BC Section

Spec has a short **Backward Compatibility** section (additive columns, inject unchanged, new event, new ACL). Acceptable for app-module work. Strengthen with:

- Explicit note: public `tripCreate` / `tripUpdate` contracts unchanged.
- Explicit note: settlement APIs/response shapes unchanged; only trip data volume grows.
- Rename section title to **Migration & Backward Compatibility** for BC doc alignment (optional).

No deprecation protocol needed (no removals).

## Spec Completeness

### Missing Sections

| Section | Impact | Recommendation |
|---------|--------|---------------|
| — | Core required sections present | None missing at section level |

### Incomplete Sections

| Section | Gap | Recommendation |
|---------|-----|---------------|
| Data Models / DTO | `metadata.paymentType` will **not** feed settlements | Settlement reads `metadata.tripRequest.paymentType` via `readTripPaymentType` / `tripRequestDetailsFromMetadata`. Spec must require writing payment type under **`metadata.tripRequest.paymentType`** (and keep snapshot enrichment consistent) |
| Proposed Solution / validators | “Relax customer when platform set” is too broad | Gate: upsert path only (`ingestSource` in `platform_sync` \| `platform_csv`) OR dedicated command that bypasses `tripCreateSchema` customer refine |
| Architecture | `tripType` for synced trips unspecified | Decide: e.g. `tripType: 'other'` or `'client'` with upsert-only exemption. Document choice — today `client` **requires** customer in zod + commands |
| API Contracts | CSV columns undefined | Add required/optional CSV header table (externalTripId, platformDriverId, startedAt, revenueAmount, status, paymentType, distanceKm, endedAt, currencyCode) + sample fixture path |
| Architecture / Phase 3 | 60‑min cron not mapped to platform mechanism | Specify: seed/register `scheduled_jobs` (target command or queue) via `packages/scheduler`, **or** org-scoped enqueue from a global tick worker. Document multi-tenant fan-out (all orgs with `platformSync.*.enabled`) |
| Commands | Undo mentions snapshots but not `extractUndoPayload` | Reference shared undo helper; for compound import, per-item undo payloads in compound command log |
| Events | `trip.updated` assumed | Add to Data/Events: declare `taxi_fleet.trip.updated` (+ `platform_sync.completed`) in `events.ts`; run generate |
| Security | No explicit `findWithDecryption` | Require decryption helpers + tenant/org scope on all trip/profile/sync-run queries |
| UI | Cmd+Enter / Escape for CSV dialog | Align with UI AGENTS dialog rules |
| Phase 3 | Partner API feasibility unknown | Add “API discovery spike” exit criteria per vendor before adapter coding |

## AGENTS.md Compliance

### Violations

| Rule | Location | Fix |
|------|----------|-----|
| Singular naming for commands | `platform_trips.import_csv` | Rename to `platform_trip.import_csv` |
| Writes via commands + undo | Commands table | Spell out `extractUndoPayload` / `buildLog` fork-EM lesson (`.ai/lessons.md`) |
| `findWithDecryption` | Security | Add MUST for all entity reads |
| Events via `createModuleEvents` | Events | Declare before emit; `yarn generate` / modules:prepare |
| `defaultRoleFeatures` with new ACL | ACL section | Explicit grant list for employee/operator (not only “prefer new feature”) |
| Worker metadata contract | Phase 3 worker | Document `metadata.queue` |
| No cross-module ORM | OK | Stay on FK IDs |
| App module placement | OK | `apps/mercato/src/modules/taxi_fleet/` |
| i18n keys | UI | OK (`taxi_fleet.platformSync.*`) |
| Zod in `data/validators.ts` | OK | Keep DTO + CSV parse schemas there |

### Lessons relevant

- **Command log identity map**: fork EM in `buildLog` after upsert prepare.
- **Button primitives**: Sync now / Import CSV must use `@open-mercato/ui` `Button`, `type="button"`.
- **Wildcard ACL**: feature gates for Sync now must use `hasFeature` (not exact `includes`).

## Risk Assessment

### High Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Wrong payment metadata shape | Uber cash misclassified as `uber_platform`; cashExpected wrong | Spec + upsert MUST write `metadata.tripRequest.paymentType` |
| Customer / tripType conflict with existing validators | Upsert fails or accidentally weakens manual create API | Dedicated upsert schema; leave `tripCreateSchema` intact |
| Partner APIs unavailable / undocumented for PL fleet accounts | Phase 3 slips; Sync now empty | CSV-first Phase 2 as primary ops path; spike each API before adapter |
| Unmapped driver IDs → all trips skipped | CRM stays empty despite sync “success” | Sync run `skipped_count` + UI banner “N drivers missing platform IDs”; link to driver profiles |
| Multi-tenant hourly fan-out without scheduler design | Missed syncs or hammering APIs | Explicit scheduler job + per-org credentials check + 429 backoff |

### Medium Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| No module workers today | First taxi_fleet worker/cron is greenfield | Copy patterns from `customer_accounts` / `data_sync` workers + scheduler docs |
| Operator reassignment vs sync overwrite | Driver ownership fights | Keep conflict rule; surface on sync run |
| Large CSV (5k rows) in request thread | Timeouts | Chunk upserts; optional queue for CSV > N rows |
| Settings secrets in `settingsJson` | Leak via GET | Mirror PayPal mask/`*Configured` in `taxiFleetSettingsSchema` |
| PWA mutate paths (PUT trip, costs) | Drivers edit marketplace trips | Guard all driver mutate routes for `ingestSource` |

### Low Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Inject still scans all trips by `metadata.requestId` | Unrelated perf | Out of scope; optional follow-up |
| Locked settlements not recalculated | Expected | Document; operator unlock + refresh |
| Plural command name | Style | Rename before ship |

## Gap Analysis

### Critical Gaps (Block Implementation)

- **Payment type persistence path**: must use `metadata.tripRequest.paymentType`, not top-level `metadata.paymentType`.
- **Customer optionality gate**: dedicated upsert/import validators; do not change global `tripCreateSchema` customer refine for all clients.
- **`tripType` for synced trips**: pick and document (`other` vs `client` + exemption).
- **Declare events**: `taxi_fleet.trip.updated`, `taxi_fleet.platform_sync.completed` in `events.ts`.
- **CSV column contract**: headers, types, required set, max rows, encoding.

### Important Gaps (Should Address)

- **Scheduler wiring**: how 60‑min job is created (seeded `scheduled_jobs` vs worker that lists orgs); payload shape; feature `require_feature`.
- **ACL grants**: exact roles in `setup.ts` for `manage_platform_sync`.
- **Undo**: `extractUndoPayload` + compound import undo semantics when partial failure.
- **Driver cost API**: confirm whether `/driver/trips/[id]/costs` must also be blocked for synced trips.
- **Search**: if trips are indexed, confirm `external_trip_id` / platform safe for search fieldPolicy (likely N/A if no trip search).
- **Idempotent sync run**: concurrent Sync now + cron for same org (lock or run-row uniqueness).

### Nice-to-Have Gaps

- Sample CSV fixture under `.ai/qa` or module fixtures.
- Migrate Strapi inject to `external_trip_id` (explicitly deferred).
- Webhook-ready inbound route stub (out of scope).
- Per-platform last-success timestamp on settings for ops UX.

## Codebase touchpoints (verified)

| Area | Current state |
|------|---------------|
| `TaxiFleetTrip` | No `external_trip_id` |
| `TaxiFleetDriverProfile` | No platform driver ID columns |
| Customer required | `tripCreateSchema` when `tripType === 'client'`; commands + UI |
| Events | No `trip.updated` / `platform_sync.*` |
| ACL | No `manage_platform_sync` |
| Workers | **None** under `taxi_fleet` |
| Settings | `settingsJson` + PayPal-style masking pattern ready to extend |
| Settlement recalc | `recalculateWeeklySettlementsForTrip` → `recalculateWeeklySettlementIfExists` reusable |
| Inject | `metadata.requestId` full-table scan — keep separate |
| paymentType | `readTripPaymentType` → `tripRequest` only |

## Remediation Plan

### Before Implementation (Must Do)

1. **Patch spec**: payment type → `metadata.tripRequest.paymentType`.
2. **Patch spec**: upsert uses dedicated zod/command; manual create rules unchanged; document `tripType`.
3. **Patch spec**: CSV header table + row limits.
4. **Patch spec**: declare both new events; singularize import command id.
5. **Patch spec**: scheduler / multi-org fan-out approach (even if “Phase 3 detail”).
6. **Patch spec**: `findWithDecryption` + `extractUndoPayload` + ACL setup grants.

### During Implementation (Add to Spec as discovered)

1. Exact adapter credential fields per vendor (after API spike).
2. Concurrent sync locking strategy once worker exists.
3. Whether driver cost mutations are blocked.

### Post-Implementation (Follow Up)

1. Optional inject → `external_trip_id` migration.
2. Partner webhook ingest reusing upsert.
3. Ops runbook for obtaining Bolt/Uber/Free driver IDs (module `AGENTS.md`).

## Recommendation

**Needs spec updates first** — then **Ready to implement Phase 1–2**.

| Phase | Readiness |
|-------|-----------|
| Phase 1 (schema, profile IDs, upsert, events, ACL) | Ready after critical gap patches (~small spec edit) |
| Phase 2 (CSV, Sync now stubs, PWA guards, settlement hook) | Ready after CSV contract + paymentType fix |
| Phase 3 (live APIs + 60‑min schedule) | **Not ready** until per-vendor API spike + scheduler design recorded |

**Suggested next step**: apply the “Before Implementation” spec patches, then start Phase 1 in code (or run `implement-spec` Phase 1 only).
