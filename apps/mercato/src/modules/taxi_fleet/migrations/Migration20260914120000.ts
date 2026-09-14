import { Migration } from '@mikro-orm/migrations'

export class Migration20260914120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "taxi_fleet_vehicle_monthly_settlements" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "resource_id" uuid not null,
        "month_start" date not null,
        "shift_gps_km" numeric(12,2) not null default 0,
        "trip_km" numeric(12,2) not null default 0,
        "empty_km" numeric(12,2) not null default 0,
        "geneta_km" numeric(12,2) null,
        "revenue_gross" numeric(14,2) not null default 0,
        "revenue_net" numeric(14,2) not null default 0,
        "bp_fuel_cost" numeric(14,2) not null default 0,
        "cash_expected" numeric(14,2) not null default 0,
        "cash_reported" numeric(14,2) not null default 0,
        "status" text not null default 'draft',
        "submitted_at" timestamptz null,
        "approved_by_user_id" uuid null,
        "approved_at" timestamptz null,
        "notes" text null,
        "snapshot_json" jsonb null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        constraint "taxi_fleet_vehicle_monthly_settlements_pkey" primary key ("id")
      );
    `)
    this.addSql(`
      create unique index if not exists "taxi_fleet_vehicle_monthly_settlements_tenant_org_resource_month_unique"
        on "taxi_fleet_vehicle_monthly_settlements" ("tenant_id", "organization_id", "resource_id", "month_start");
    `)
    this.addSql(`
      create index if not exists "taxi_fleet_vehicle_monthly_settlements_scope_idx"
        on "taxi_fleet_vehicle_monthly_settlements" ("tenant_id", "organization_id");
    `)
    this.addSql(`
      create index if not exists "taxi_fleet_vehicle_monthly_settlements_month_idx"
        on "taxi_fleet_vehicle_monthly_settlements" ("month_start", "tenant_id");
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "taxi_fleet_vehicle_monthly_settlements" cascade;`)
  }
}
