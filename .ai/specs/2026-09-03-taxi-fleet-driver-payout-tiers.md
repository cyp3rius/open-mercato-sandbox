# Taxi Fleet — driver payout percent tiers

## TLDR

- Drivers keep **fixed** payout `%` or switch to **tiered** brackets (`from`/`to`/`percent`).
- Weekly settlement picks **one** matching tier from `netAmount` (`[from, to)`), then applies the existing payout formula unchanged.
- Empty `from` → `0`, empty `to` → `∞`. Matched `%` is snapshotted on the weekly settlement row (+ audit meta in `snapshot_json`).

## Overview

RS Moto needs two compensation schemes on `taxi_fleet_driver_profiles`: a constant percent (today) and a step-function of net weekly profit. Monthly settlements stay a rollup of weekly `payout_amount`.

## Problem Statement

Some drivers earn a higher share once weekly net crosses amount thresholds. The platform only stored a single `payout_percent`, so operators could not encode those schedules or have settlements pick the correct percent automatically.

## Proposed Solution

1. Add `payout_mode` (`fixed` | `tiered`) and `payout_tiers_json` on the driver profile.
2. Keep `payout_percent` for fixed mode (and as the resolved snapshot column on weekly settlements).
3. On unlocked weekly recalculation: compute `netAmount` first; if tiered, select the matching bracket; write `payout_percent` + payout meta into the settlement; run `payout = net × %/100 + bonus + compensation`.
4. If no tier matches → business error (do not silently use 0%).

## Architecture

```
DriverProfile (mode + tiers|fixed%)
        │
        ▼
Weekly recalc → revenue/costs → netAmount
        │
        ▼
resolveEffectivePayoutPercent(net, profile)
        │
        ▼
snapshot payout_percent + payout meta → computeDriverPayoutAmount
```

## Data Models

### `taxi_fleet_driver_profiles`

| Column | Type | Notes |
|--------|------|--------|
| `payout_mode` | text | `fixed` (default) \| `tiered` |
| `payout_tiers_json` | jsonb nullable | `PayoutTier[]` when tiered |
| `payout_percent` | numeric(5,2) | unchanged; used for fixed |

```ts
type PayoutTier = {
  fromAmount: number | null  // null => 0
  toAmount: number | null    // null => Infinity
  percent: number            // 0–100
}
```

Validation: ≥1 tier when tiered; `from < to` after normalize; no overlapping `[from, to)` ranges; percent 0–100.

### Weekly settlement

- Column `payout_percent` remains the **resolved** percent used for the week.
- `snapshot_json.payout` audit block: `{ mode, tiers, matchedTier, selectionNetAmount, percent }`.

## API Contracts

- `POST/PUT /api/taxi_fleet/driver-profiles` accept `payoutMode`, `payoutTiers` (array).
- List/detail include `payoutMode`, `payoutTiers`.
- Settlements continue to expose `payoutPercent`; detail may surface snapshot payout meta for UI.

## Behavior

| Mode | Percent source |
|------|----------------|
| `fixed` | Profile `%` (org default fallback when profile ≤0) — same as today |
| `tiered` | Tier matching `netAmount` in `[from, to)` |

Locked settlements do not re-resolve percent from the profile.

## Risks & Impact Review

| Scenario | Severity | Mitigation |
|----------|----------|------------|
| Gap in tiers → recalc fails | Medium | Clear API error; UI validation before save |
| Overlapping tiers misconfigured | Medium | Reject on profile save |
| Operator changes tiers mid-week | Low | Unlocked weeks re-sync on recalc; locked keep snapshot |
| Negative net | Low | Open lower bound `[0, …)` still matches if from=0; negative may miss → error unless a tier covers negatives |

## Phasing

1. Spec + entity/migration + pure tier lib/tests
2. Settlement resolve path + snapshot meta
3. Profile API/commands + UI editor + settlement basics display
4. Verify build / unit tests

## Changelog

- 2026-09-03: Initial spec — fixed vs tiered driver payout schedules.
