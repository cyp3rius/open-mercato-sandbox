import { Migration } from '@mikro-orm/migrations'

export class Migration20260703102539 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "taxi_fleet_daily_assignments" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "team_member_id" uuid not null, "resource_id" uuid not null, "assignment_date" date not null, "shift_start" timestamptz null, "shift_end" timestamptz null, "status" text not null default 'planned', "notes" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "taxi_fleet_daily_assignments_pkey" primary key ("id"));`)
    this.addSql(`create index if not exists "taxi_fleet_daily_assignments_date_idx" on "taxi_fleet_daily_assignments" ("assignment_date", "tenant_id");`)
    this.addSql(`create index if not exists "taxi_fleet_daily_assignments_scope_idx" on "taxi_fleet_daily_assignments" ("tenant_id", "organization_id");`)
    this.addSql(`alter table "taxi_fleet_daily_assignments" drop constraint if exists "taxi_fleet_daily_assignments_tenant_id_organizati_bb836_unique";`)
    this.addSql(`alter table "taxi_fleet_daily_assignments" add constraint "taxi_fleet_daily_assignments_tenant_id_organizati_bb836_unique" unique ("tenant_id", "organization_id", "resource_id", "assignment_date");`)
    this.addSql(`alter table "taxi_fleet_daily_assignments" drop constraint if exists "taxi_fleet_daily_assignments_tenant_id_organizati_f3557_unique";`)
    this.addSql(`alter table "taxi_fleet_daily_assignments" add constraint "taxi_fleet_daily_assignments_tenant_id_organizati_f3557_unique" unique ("tenant_id", "organization_id", "team_member_id", "assignment_date");`)

    this.addSql(`create table if not exists "taxi_fleet_driver_profiles" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "team_member_id" uuid not null, "payout_percent" numeric(5,2) not null default 0, "default_resource_id" uuid null, "external_app_enabled" boolean not null default false, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "taxi_fleet_driver_profiles_pkey" primary key ("id"));`)
    this.addSql(`create index if not exists "taxi_fleet_driver_profiles_scope_idx" on "taxi_fleet_driver_profiles" ("tenant_id", "organization_id");`)
    this.addSql(`alter table "taxi_fleet_driver_profiles" drop constraint if exists "taxi_fleet_driver_profiles_tenant_id_organization_b79bb_unique";`)
    this.addSql(`alter table "taxi_fleet_driver_profiles" add constraint "taxi_fleet_driver_profiles_tenant_id_organization_b79bb_unique" unique ("tenant_id", "organization_id", "team_member_id");`)

    this.addSql(`create table if not exists "taxi_fleet_trips" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "team_member_id" uuid not null, "resource_id" uuid not null, "assignment_id" uuid null, "trip_type" text not null, "started_at" timestamptz null, "ended_at" timestamptz null, "odometer_start" numeric(12,2) null, "odometer_end" numeric(12,2) null, "distance_km" numeric(12,2) null, "revenue_amount" numeric(14,2) null, "currency_code" text not null default 'PLN', "customer_person_id" uuid null, "customer_company_id" uuid null, "status" text not null default 'draft', "notes" text null, "metadata" jsonb null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "taxi_fleet_trips_pkey" primary key ("id"));`)
    this.addSql(`create index if not exists "taxi_fleet_trips_status_idx" on "taxi_fleet_trips" ("status", "tenant_id");`)
    this.addSql(`create index if not exists "taxi_fleet_trips_member_idx" on "taxi_fleet_trips" ("team_member_id", "tenant_id");`)
    this.addSql(`create index if not exists "taxi_fleet_trips_scope_idx" on "taxi_fleet_trips" ("tenant_id", "organization_id");`)

    this.addSql(`create table if not exists "taxi_fleet_trip_cost_lines" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "trip_id" uuid not null, "cost_type" text not null, "amount" numeric(14,2) not null, "currency_code" text not null default 'PLN', "quantity" numeric(12,3) null, "unit_price" numeric(14,2) null, "receipt_attachment_id" uuid null, "notes" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "taxi_fleet_trip_cost_lines_pkey" primary key ("id"));`)
    this.addSql(`create index if not exists "taxi_fleet_trip_cost_lines_trip_idx" on "taxi_fleet_trip_cost_lines" ("trip_id");`)

    this.addSql(`create table if not exists "taxi_fleet_weekly_settlements" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "team_member_id" uuid not null, "week_start" date not null, "total_revenue" numeric(14,2) not null default 0, "total_costs" numeric(14,2) not null default 0, "net_amount" numeric(14,2) not null default 0, "payout_percent" numeric(5,2) not null default 0, "payout_amount" numeric(14,2) not null default 0, "status" text not null default 'draft', "submitted_at" timestamptz null, "approved_by_user_id" uuid null, "approved_at" timestamptz null, "snapshot_json" jsonb null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "taxi_fleet_weekly_settlements_pkey" primary key ("id"));`)
    this.addSql(`create index if not exists "taxi_fleet_weekly_settlements_scope_idx" on "taxi_fleet_weekly_settlements" ("tenant_id", "organization_id");`)
    this.addSql(`alter table "taxi_fleet_weekly_settlements" drop constraint if exists "taxi_fleet_weekly_settlements_tenant_id_organizat_c936b_unique";`)
    this.addSql(`alter table "taxi_fleet_weekly_settlements" add constraint "taxi_fleet_weekly_settlements_tenant_id_organizat_c936b_unique" unique ("tenant_id", "organization_id", "team_member_id", "week_start");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "taxi_fleet_trip_cost_lines" cascade;`)
    this.addSql(`drop table if exists "taxi_fleet_trips" cascade;`)
    this.addSql(`drop table if exists "taxi_fleet_weekly_settlements" cascade;`)
    this.addSql(`drop table if exists "taxi_fleet_daily_assignments" cascade;`)
    this.addSql(`drop table if exists "taxi_fleet_driver_profiles" cascade;`)
  }
}
