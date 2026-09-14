# Taxi Fleet — Monthly vehicle settlement (FRE pojazdu)

## TLDR

**Key Points:**
- New per-vehicle monthly settlement, generated only after the calendar month ends.
- Distance = sum of assignment GPS km for that `resourceId` in the month (recalc from pings when stored km missing).
- Cash: operator enters `cashReported`; CRM `cashExpected` = sum of trips with `paymentType === 'cash'` on that vehicle; variance = reported − expected.
- Other payment types are summarized separately and do not enter cash variance.
- BP fuel costs: manual sync from bp Open Fleet (gross), matched by resource CF `bp_fuel_card_number`.
- Geneta km: field reserved on taxi fieldset; import later.

**Scope:**
- Entity, API, generate/recalc, operator list/detail, settlements hub under Vehicles.
- Taxi resource fieldset + BP Open Fleet sync.
- Out of scope: Geneta km import, cron BP sync, XLS emedia fallback, driver payout rewrite.

## Decisions

| Decision | Choice |
|----------|--------|
| Period | Calendar month; generate only if `isMonthFullyCompleted` |
| Identity | `(tenant, org, resourceId, monthStart)` |
| Distance | Assignment GPS by vehicle (not monthly-driver trip-km rule) |
| Cash reconcile | Manual `cashReported` vs cash trips only |
| BP amount | Gross invoice value |
| BP mapping | Resource CF `bp_fuel_card_number` |
| BP sync | Manual button on vehicle monthly settlement detail |
| Taxi integrations fieldset | `resources_resource_taxi` (platforms, fuel card, devices) |

## Architecture

```
Assignments (resourceId, month) → GPS km
Trips (resourceId, month) → revenue by paymentType + cashExpected
Operator cashReported → variance
BP Open Fleet (card number) → bpFuelCost (gross)
        ↓
TaxiFleetVehicleMonthlySettlement
```

## Phases

1. Spec + entity + migration + calculator + commands/API — done
2. UI list/detail + hub + breadcrumbs + i18n — done
3. Taxi fieldset + BP Open Fleet manual sync — done (this change)
4. Geneta km import — future

## Commands

- `taxi_fleet.vehicle_monthly_settlements.generate_month`
- `taxi_fleet.vehicle_monthly_settlements.update`
- `taxi_fleet.vehicle_monthly_settlements.delete`
- `taxi_fleet.vehicle_monthly_settlements.sync_bp`

## Migration & BC

Additive table only. No changes to existing driver monthly settlement contracts.
Taxi fieldset is additive; shared vehicle CF keys use `fieldsets: [vehicle, taxi]`.
