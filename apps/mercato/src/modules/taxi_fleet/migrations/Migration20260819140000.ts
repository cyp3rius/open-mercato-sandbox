import { Migration } from '@mikro-orm/migrations'

export class Migration20260819140000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "taxi_fleet_monthly_settlements" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "month_start" date not null,
        "revenue_gross" numeric(14,2) not null default 0,
        "revenue_net" numeric(14,2) not null default 0,
        "costs_gross" numeric(14,2) not null default 0,
        "costs_net" numeric(14,2) not null default 0,
        "net_amount" numeric(14,2) not null default 0,
        "payout_amount" numeric(14,2) not null default 0,
        "total_distance_km" numeric(12,2) not null default 0,
        "cash_expected" numeric(14,2) not null default 0,
        "cash_collected" numeric(14,2) not null default 0,
        "bonus_amount" numeric(14,2) not null default 0,
        "compensation_amount" numeric(14,2) not null default 0,
        "airport_a4_amount" numeric(14,2) not null default 0,
        "transfer_amount" numeric(14,2) not null default 0,
        "weekly_count" int not null default 0,
        "driver_count" int not null default 0,
        "status" text not null default 'draft',
        "approved_by_user_id" uuid null,
        "approved_at" timestamptz null,
        "notes" text null,
        "snapshot_json" jsonb null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        constraint "taxi_fleet_monthly_settlements_pkey" primary key ("id")
      );
    `)
    this.addSql(`
      create index if not exists "taxi_fleet_monthly_settlements_scope_idx"
        on "taxi_fleet_monthly_settlements" ("tenant_id", "organization_id");
    `)
    this.addSql(`
      alter table "taxi_fleet_monthly_settlements"
        drop constraint if exists "taxi_fleet_monthly_settlements_tenant_id_organization_id_month_start_unique";
    `)
    this.addSql(`
      alter table "taxi_fleet_monthly_settlements"
        add constraint "taxi_fleet_monthly_settlements_tenant_id_organization_id_month_start_unique"
        unique ("tenant_id", "organization_id", "month_start");
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "taxi_fleet_monthly_settlements" cascade;`)
  }
}
