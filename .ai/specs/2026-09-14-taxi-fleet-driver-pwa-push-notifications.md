# Taxi Fleet — Driver PWA Web Push notifications

**Date**: 2026-09-14  
**Status**: Implemented  
**Module**: `taxi_fleet` (`apps/mercato/src/modules/taxi_fleet/`)  
**Related**: `.ai/specs/2026-07-03-taxi-fleet-module.md`, plan “Powiadomienia PWA kierowcy”

## TLDR

**Key Points:**
- Driver OS notifications use **Web Push + Service Worker** (`Notification` API), not local scheduled triggers (abandoned / unreliable when PWA is closed).
- Two kinds: **new assigned scheduled trip** (`taxi_fleet.trip.assigned`) and **reminder 1 hour before** `startedAt`.
- Click opens **`/driver/trips/{id}`**.
- Optional VAPID env; if unset, subscribe API returns 503 and sends no-op.

**Scope:**
- Push subscription entity + driver API
- SW `push` / `notificationclick`
- Assign subscriber → Web Push
- Cron/queue reminder job (±5 min window around T−1h)
- DriverShell permission UX

**Out of scope:** Capacitor/native exact alarms; silent push; CRM in-app link changes (CRM keeps `/backend/...`).

## Overview

Drivers need tray alerts when a dispatcher assigns a scheduled trip and again ~1 hour before pickup. Pure local timers cannot wake a closed PWA. Web Push wakes the installed SW, which calls `showNotification` and handles deep links.

## Problem Statement

- Driver PWA discovers trips only on open / pull-to-refresh.
- CRM already emits `taxi_fleet.trip.assigned` for in-app inbox with backend URLs — not OS push to `/driver`.
- Notification Triggers API was abandoned; local `setTimeout` dies when backgrounded.

## Proposed Solution

1. Persist PushSubscription per driver device (`taxi_fleet_push_subscriptions`).
2. PWA requests permission, subscribes with VAPID public key, POSTs subscription to API.
3. On `taxi_fleet.trip.assigned`, send Web Push payload `{ kind, tripId, url, title, body }`.
4. Every 5 minutes, org-scoped queue job finds `status=scheduled` trips with `startedAt` in [now+55m, now+65m] and `driver_reminder_push_sent_at` null → send reminder → stamp sentAt.
5. Reset `driver_reminder_push_sent_at` when `startedAt` changes so reschedules get a new reminder.
6. SW `notificationclick` focuses or opens `/driver/trips/{id}`.

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| Web Push (not local schedule) | Only reliable wake for closed PWA on Android + iOS 16.4+ installed |
| Separate CRM vs driver URLs | In-app CRM stays `/backend/...`; push uses `/driver/...` |
| Cron window ±5 min | Idempotent without cancelling delayed jobs; handles reschedule |
| Column on trip for reminder sent | Simple query; no separate reminder ledger |
| Optional VAPID | Feature degrades gracefully in local/dev without keys |

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| Local Notification Triggers | Abandoned by Chrome; never shipped |
| Foreground-only timers | Misses closed-app / lock-screen cases |
| Capacitor native alarms | Heavier packaging; deferred |

## Architecture

```
CRM assign/schedule → taxi_fleet.trip.assigned
  → in-app notification (existing)
  → sendDriverWebPush (subscriptions for teamMember)

Scheduler */5 * * * * → taxi-fleet-driver-push-reminders queue
  → scan scheduled trips near T−1h → push → stamp sentAt

Driver PWA → permission → pushManager.subscribe → POST /api/taxi_fleet/driver/push-subscription
driver-sw.js ← push event → showNotification → notificationclick → /driver/trips/{id}
```

## Data Models

### `taxi_fleet_push_subscriptions`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id / organization_id | uuid | scope |
| user_id | uuid | auth user |
| team_member_id | uuid | driver staff member |
| endpoint | text | unique |
| p256dh / auth | text | subscription keys |
| user_agent | text null | optional |
| created_at / updated_at | timestamptz | |
| deleted_at | timestamptz null | soft delete / unsubscribe |

### `taxi_fleet_trips.driver_reminder_push_sent_at`

Nullable timestamptz; set when T−1h reminder push succeeds; cleared when `startedAt` changes.

## API Contracts

| Method | Path | Auth | Body / behavior |
|--------|------|------|-----------------|
| GET | `/api/taxi_fleet/driver/push-subscription` | `taxi_fleet.driver` | `{ configured, subscribed, vapidPublicKey }` |
| POST | `/api/taxi_fleet/driver/push-subscription` | same | PushSubscription JSON → upsert |
| DELETE | `/api/taxi_fleet/driver/push-subscription` | same | `{ endpoint }` → soft-delete |

Push payload (JSON in `push` event data):

```json
{
  "kind": "trip_assigned" | "trip_reminder",
  "tripId": "<uuid>",
  "url": "/driver/trips/<uuid>",
  "title": "...",
  "body": "..."
}
```

## Env

```bash
WEB_PUSH_ENABLED=false
WEB_PUSH_VAPID_PUBLIC_KEY=
WEB_PUSH_VAPID_PRIVATE_KEY=
WEB_PUSH_VAPID_SUBJECT=mailto:ops@example.com
NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY=   # same public key
```

Generate: `npx web-push generate-vapid-keys`

`WEB_PUSH_ENABLED` defaults to **false**. When false, the feature is fully dark (no banner, `configured: false`, POST 403). When true, VAPID keys are required (`configured` only if keys present; POST 503 if enabled without keys).

## Migration & Backward Compatibility

- Additive table + nullable column only.
- Existing in-app notifications unchanged.
- No push without VAPID or subscription — non-breaking.

## Risks & Impact Review

| Failure | Severity | Area | Mitigation | Residual |
|---------|----------|------|------------|----------|
| Missing VAPID | Low | Dev/misconfig | API 503 + no-op send | Feature off until configured |
| Stale endpoint (410) | Low | Push | Delete subscription on gone | User must re-enable |
| iOS without Add to Home Screen | Med | Delivery | UX copy in banner | Browser Safari limited |
| Reminder timing best-effort | Med | T−1h | ±5 min window + cron | Not exact AlarmManager |
| Duplicate assign events | Low | Spam | Notification `tag` = kind+tripId | OS replaces same tag |

## Final Compliance Report

- Tenant/org scoped subscriptions; driver can only manage own endpoints.
- No cross-module ORM relations; FK ids only.
- Additive schema; optional env contract.
- Deep link stays inside `/driver` SW scope.

## Changelog

| Date | Summary |
|------|---------|
| 2026-09-14 | Initial implementation: Web Push subscriptions, SW handlers, assign + T−1h reminder pipeline, driver UX. |

## Manual smoke checklist

1. Set VAPID keys in `.env` / `.env.local` (`npx web-push generate-vapid-keys`) and restart app + workers/scheduler.
2. Run migration `Migration20260914190000` (`yarn db:migrate`).
3. Install driver PWA (Android Chrome or iOS Add to Home Screen).
4. Log in as driver → allow Alerts banner → badge turns green.
5. From CRM assign a scheduled trip to that driver → OS notification → tap → `/driver/trips/{id}`.
6. Create/schedule a trip with `startedAt` ≈ now + 1h → within ~5–10 min of the T−1h window, reminder push fires once (`driver_reminder_push_sent_at` set).
7. Change `startedAt` → stamp cleared → new reminder can fire for the new window.
