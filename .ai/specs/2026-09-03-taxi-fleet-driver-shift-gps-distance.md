# Taxi Fleet — Driver Shift Punch, GPS Distance & Empty Km

## TLDR

Separate planned allocation hours from driver punch times, allow clock-in/out within configurable grace hours (default ±3), stabilize the GPS permission banner to show only on denial, and use shift GPS distance as weekly `totalDistanceKm` with derived `emptyDistanceKm = max(0, total − trip km)`.

## Problem Statement

1. `shiftStart`/`shiftEnd` were dual-use (dispatcher plan + punch). Allocations with both times looked “ended”; clock-in/out became no-ops.
2. Drivers need to start earlier (e.g. commute to work) and end later than planned.
3. The GPS enable banner reappeared after a successful grant (timeout / remount / Permissions API quirks).
4. Location pings were stored but never aggregated; weekly settlement distance was trip-sum only — empty/deadhead km was missing.

## Proposed Solution

- Add `plannedShiftStart` / `plannedShiftEnd` for schedule; keep `shiftStart` / `shiftEnd` as actual punches only.
- Settings: `hoursBeforeShift` / `hoursAfterShift` (default 3) gate start/end against planned window.
- On shift end (and settlement recalc): haversine over assignment location pings → `gpsDistanceKm`.
- Weekly settlement: `totalDistanceKm` = shift GPS km when GPS data exists, otherwise the trip km sum (legacy behaviour); `computedDistanceKm` = trip km; `emptyDistanceKm` = max(0, total − trips).
- GPS banner: sticky `ready` after grant; full banner only for `denied`.

## Data Models

### `taxi_fleet_daily_assignments`

| Column | Meaning |
|--------|---------|
| `planned_shift_start` / `planned_shift_end` | Dispatcher schedule |
| `shift_start` / `shift_end` | Driver punch (null until clocked) |
| `gps_distance_km` | Aggregated GPS km after close / recalc |

Migration: copy existing start/end → planned; clear punch fields when `status = 'planned'`.

### `taxi_fleet_weekly_settlements`

| Column | Meaning |
|--------|---------|
| `computed_distance_km` | Sum of trip `distance_km` |
| `total_distance_km` | GPS km when available; otherwise trip km sum (manual override preserved) |
| `empty_distance_km` | `max(0, total − computed)` |

### Settings (`settingsJson`)

- `hoursBeforeShift` / `hoursAfterShift`: int 0–48, default 3.

## API / Behavior

- `POST .../driver/assignments/{id}/shift`:
  - `start`: allowed from `plannedStart − hoursBefore` until `plannedEnd + hoursAfter`; sets `shiftStart = now`.
  - `end`: requires open shift; allowed until `plannedEnd + hoursAfter` (and during shift); sets `shiftEnd = now`, computes `gpsDistanceKm`.
- Assignment CRUD writes planned hours only.
- Open shift = `shiftStart && !shiftEnd`. Trip past window prefers punch times, else planned.
- Fuel/revenue per km use `totalDistanceKm` (GPS total when GPS exists, otherwise trip sum).

## Risks

| Risk | Mitigation |
|------|------------|
| Sparse GPS undercounts km | Recalc from pings; accept browser foreground limits |
| Existing confirmed rows may mix plan/punch | Best-effort migration; planned always copied |
| Manual total override | Keep existing override path; recompute empty from total − trips |

## Changelog

### 2026-09-03

- Plan vs punch fields, grace settings, GPS distance on assignments, empty km on weekly settlements, GPS banner denial-only.
