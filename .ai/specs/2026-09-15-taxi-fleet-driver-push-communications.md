# Taxi Fleet — Driver push preferences, settlements & CRM communications

**Date**: 2026-09-15  
**Status**: Implemented  
**Module**: `taxi_fleet` (+ core `notifications` preferences)  
**Related**: `.ai/specs/2026-09-14-taxi-fleet-driver-pwa-push-notifications.md`

## TLDR

**Key Points:**
- Push channel preferences (`pushChannel` + `push_enabled`) gate non-forced Web Push.
- Trip assign/reminder push is **locked** (always delivered when push is configured).
- New pushes: planned assignment (skip ad-hoc), weekly/monthly settlement approved.
- CRM **Komunikaty** under Fleet (outside Daily work): pick specific drivers, schedule/send, read receipts, retry.

## Overview

Extends driver PWA Web Push beyond trips: shifts, settlements, and operator broadcasts, with user-visible Push toggles on `/backend/profile/notifications`.

## Preference gate

- Types declare `userPreference.pushChannel?: { defaultEnabled?, locked? }`.
- Storage: `user_notification_preferences.push_enabled` (nullable = type default).
- `shouldDeliverPush(em, userId, tenantId, type)`:
  - no `pushChannel` → false
  - `locked` → true
  - else stored / default

## Event pushes

| Event | Kind | Preference type | Locked |
|-------|------|-----------------|--------|
| `taxi_fleet.trip.assigned` | `trip_assigned` | `taxi_fleet.trip.assigned` | yes |
| Reminder cron | `trip_reminder` | `taxi_fleet.trip.reminder` | yes |
| Sunday 10:00 cron | `week_end_reminder` | `taxi_fleet.week_end.reminder` | yes |
| `taxi_fleet.assignment.created` (!adHoc) | `assignment_planned` | `taxi_fleet.assignment.planned` | no |
| `taxi_fleet.settlement.approved` | `settlement_ready` | `taxi_fleet.settlement.ready` | no |
| `taxi_fleet.monthly_settlement.approved` | `monthly_settlement_ready` | `taxi_fleet.monthly_settlement.ready` | no |
| CRM send/schedule | `driver_broadcast` | `taxi_fleet.driver_broadcast` | no |

Deep links: trips `/driver/trips/{id}`, assignments `/driver/assignments`, weekly `/driver/settlements/{id}`, monthly `/driver/monthly-settlements/{id}`, broadcast → `/driver` + ack. `week_end_reminder` has **no** click action (dismiss only).

## CRM communications

- Tables: `taxi_fleet_driver_communications`, `taxi_fleet_driver_communication_recipients`
- Limits: title ≤80, body ≤180; kinds `info|service|direct` (urgency normal/high/high)
- Status: `draft|scheduled|sending|sent|cancelled`
- ACL: `taxi_fleet.manage_driver_communications`
- Nav: `/backend/taxi-fleet/communications` — `pageGroupKey: backend.nav.section.fleet`, `navFlat: true`, `pageOrder: 4610` (not Daily work dedupe)
- APIs: CRUD, send, schedule, cancel, recipient retry, driver `POST .../communications/ack`
- Cron `* * * * *` → queue `taxi-fleet-driver-communications`

## Migration & BC

- Additive DB columns/tables and preference API fields.
- Trip push now respects locked preference channel (still forced ON) — intentional vs prior ungated push.

## Integration coverage

- Preferences API GET/PUT push fields
- Assignment/settlement/monthly subscribers → `sendDriverPushIfAllowed`
- Communications list/create/detail UI + schedule worker
- SW `driver_broadcast` click → ack + focus `/driver`

## Unit tests

- `lib/driverCommunications/__tests__/communicationsHelpers.test.ts` — urgency, preference kinds, title/body limits
- Existing `lib/driverPush/__tests__/driverPushHelpers.test.ts` — reminder window / VAPID
