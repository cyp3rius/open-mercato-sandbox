# Taxi Fleet — Monthly per-driver settlement + payout

## TLDR

**Key Points:**
- Weekly settlements become **control-only** (no payout / no `paid` closure).
- Monthly settlements become **per driver**, same status flow as weekly (`draft → submitted → approved → paid`), and own the **actual payout**.
- Revenue mix is hybrid: calendar-month non-platform trips + costs + cash; platform trips from weeklies whose `weekStart` falls in the month, with cross-month trip-ID dedupe.
- Monthly payout is segmented (ISO-week slices); payout % is resolved per segment, not from the whole-month net.

**Scope:**
- Schema/API/UI for per-driver monthly settlements + operator close-payout
- Remove weekly payout path
- Driver PWA read-only monthly list/detail (payout view)
- Monthly document uploads (cash register per vehicle, fuel, treasury) without auto-validation

**Concerns:**
- Existing org-level monthly rows must be soft-deleted/migrated away (sandbox / single-tenant RS Moto).
- Cash-register amount verification vs CRM is explicitly out of scope for this release.

## Overview

Operators currently close payouts on weekly settlements. The fleet process changes: weeklies stay as mid-month control views; the calendar-month settlement per driver is the document that drives payout. Platform marketplaces settle weekly, so platform revenue is still taken from weeklies that start in the month, while cash report and non-platform activity follow the calendar month.

> **Market Reference:** Fleet payroll / marketplace settlement tools typically separate control periods from payout periods and avoid double-paying marketplace trips across period boundaries. We adopt trip-ID claiming across monthly snapshots; we reject pure week-rollup as the sole monthly definition because cash register and costs are calendar-month.

## Problem Statement

- Weekly close-payout does not match the business process (no real weekly bank payout).
- Org-level monthly rollup cannot drive per-driver payout UI/status.
- Calendar vs ISO-week mismatch would double-count platform trips on month boundaries without explicit dedupe.
- Drivers can see weeklies but not the monthly payout document.

## Proposed Solution

1. Block weekly transition to `paid` and hide close-payout UI; keep `draft|submitted|approved` as control states.
2. Reshape `TaxiFleetMonthlySettlement` to per `(tenant, org, teamMemberId, monthStart)` with weekly-parity money/closure fields and statuses.
3. Hybrid calculator + `platformTripIds` snapshot claiming so prior months exclude already-settled platform trips.
4. Operator UI mirrors weekly settlement detail (including close payout).
5. Driver PWA: monthly read-only from `approved` onward; weeklies remain control preview.
6. `TaxiFleetMonthlySettlementDocument` for uploads; no automatic CRM amount match yet.

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| Per-driver monthly entity (alter existing table) | Matches weekly UX; one payout document per driver |
| Platform from weeklies by `weekStart` + trip-ID dedupe | Matches marketplace weekly reports; prevents double pay |
| Non-platform + costs + cash from calendar month | Matches cash register / fiscal month |
| Driver PWA visibility from `approved` | Avoids showing operator drafts |
| Documents at org+month (+ optional `resourceId`) | Cash register is per vehicle, not per driver |

## User Stories

- **Operator** wants to generate a past month’s settlements per driver and close payout so drivers are paid once.
- **Operator** wants weeklies without payout so mid-month control does not imply bank transfer.
- **Driver** wants to see monthly payout status/amounts in the PWA.
- **Operator** wants to upload cash/fuel/treasury files for the month (verification later).

## Architecture

```
Calendar trips (non-platform) + expenses + cash
        +
Weeklies (weekStart in month) → platform trips − alreadySettledPlatformTripIds
        ↓
Per-driver TaxiFleetMonthlySettlement (draft…paid)
        ↓
Operator close payout | Driver PWA read-only
```

### Commands & Events

- `taxi_fleet.monthly_settlements.generate_month` — batch or per-driver for a completed month
- `taxi_fleet.monthly_settlements.update` — fields, recalc, status, closure→paid
- `taxi_fleet.monthly_settlements.delete` — soft-delete draft
- Events (optional parity): `taxi_fleet.monthly_settlement.approved` (additive if needed)
- Weekly: reject `paid` / closure updates

## Data Models

### TaxiFleetMonthlySettlement

- `team_member_id` (required)
- Unique `(tenant_id, organization_id, team_member_id, month_start)`
- Status: `draft | submitted | approved | paid`
- Money fields aligned with weekly + `payout_percent`, distance fields, closure fields
- `weekly_count`; drop `driver_count` meaning (nullable/unused)
- `snapshot_json`: revenueBreakdown, platformTripIds, platformTripIdsSkippedAlreadySettled, weeklySettlementIds, `segments` (per-segment net + payout%), trips, costs, …

### TaxiFleetMonthlySettlementDocument

- `month_start`, `kind` (`cash_register|fuel|treasury|other`)
- `resource_id` required when `kind=cash_register`
- `attachment_id`, `parsed_json`, `notes`
- Scope: tenant + organization (+ month); not per driver

## API Contracts

| Method | Path | Notes |
|--------|------|-------|
| GET/PUT/DELETE | `/api/taxi_fleet/monthly-settlements` | Filter `teamMemberId`, `monthStart`, `status` |
| POST | `/api/taxi_fleet/monthly-settlements/generate` | Past months only; creates per-driver drafts |
| GET | `/api/taxi_fleet/driver/monthly-settlements` | Own driver; statuses ≥ approved |
| GET | `/api/taxi_fleet/driver/monthly-settlements/[id]` | Own driver detail |
| GET/POST | `/api/taxi_fleet/monthly-settlement-documents` | Upload/list month docs |

## Phasing

1. Spec + weekly no-payout
2. Schema migration + documents entity
3. Calculator + commands/API
4. Operator UI
5. Driver PWA monthly
6. Document upload UI
7. Unit tests (hybrid + dedupe + FSM + month gate)

## Risks & Impact Review

| Risk | Severity | Mitigation |
|------|----------|------------|
| Double-count platform trips across months | High | Persist `platformTripIds`; exclude prior months’ IDs |
| Breaking org-level monthly rows | Medium | Soft-delete existing fleet rollups in migration |
| Drivers confused by weekly vs monthly | Low | PWA labels: control vs payout |
| Upload without validation | Low | Explicit deferred phase; UI note |

## Final Compliance Report

- Module conventions: app module `taxi_fleet`, snake_case tables, command pattern for writes
- BC: additive status/fields on monthly; weekly `paid` blocked (behavior change documented)
- i18n: EN+PL for new UI strings
- No cross-module ORM relations

## Changelog

### 2026-09-09
- Initial spec: per-driver monthly payout settlements, weekly control-only, hybrid aggregation, platform trip dedupe, driver PWA monthly preview, document uploads without auto-validation.
- Operator monthly detail: trips + costs tabs (same content as weekly reconcile lists for items entering the monthly formula), optional weekly settlement link per row (`target=_blank`); snapshot stores `trips` / `costs` with `weeklySettlementId` / `weekStart`.
- Segmented monthly payout: ISO-week slices (`leading` + `week`), per-segment payout % from driver schedule, month `payoutAmount` = sum of segment bases (+ month-level bonus/compensation). Basics UI no longer shows a single payout percent; `snapshot.segments` + Segments panel.
- Monthly cash vs transfer: `cashExpected`/`cashCollected` on monthly rows are rolled up from weeklies in the month (`weeklyCashHandover`); no cash panel on monthly detail; Basics panel moved to sidebar; driver name links to taxi fleet driver profile.
- Straddle week payout: leading segment links to prior-month ISO week weekly; payout = `weekly.payoutAmount − prior trailing segment payout` (`weekly_remainder`). Trailing partial annotated in snapshot. Monthly payout is **transfer-only** (no cash payout); cash handover remains weekly control.
