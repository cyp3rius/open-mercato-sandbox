# Taxi Fleet — Internal trips without receipt + CRM authorization

**Date**: 2026-09-15  
**Status**: Implemented  
**Module**: `taxi_fleet`

## Summary

Internal (`tripType === 'internal'`) trips:

- Driver app: no payment method, no receipt required
- On finish: status `pending_authorization` (not settlement-eligible)
- CRM: authorize with ACL `taxi_fleet.trips.authorize_internal` → `completed` (then counted in weekly settlement revenue)

## Details

- Commercial fields: `showReceipt: false` for internal ([`driverTripCommercialFields.ts`](../../apps/mercato/src/modules/taxi_fleet/lib/driverTripCommercialFields.ts))
- Receipt rules: `tripRequiresIncomeReceipt` skips `internal`
- Status dictionary default includes `pending_authorization`; merge appends missing default codes for existing orgs
- Command/route: `taxi_fleet.trips.authorize_internal` / `POST .../authorize-internal`
- Create/update/complete coerce `completed` → `pending_authorization` for internal trips
- Audit metadata: `internalAuthorizedAt`, `internalAuthorizedByUserId`
- CRM notification `taxi_fleet.trip.pending_authorization` to users with `taxi_fleet.trips.authorize_internal`
