export const TAXI_FLEET_COST_TYPES = ['fuel', 'toll', 'parking', 'maintenance', 'other'] as const

export type TaxiFleetCostType = (typeof TAXI_FLEET_COST_TYPES)[number]
