import { Migration } from '@mikro-orm/migrations'

export class Migration20260909160000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      update "taxi_fleet_monthly_settlements"
      set "deleted_at" = coalesce("deleted_at", now())
      where "deleted_at" is null;
    `)

    this.addSql(`
      alter table "taxi_fleet_monthly_settlements"
        add column if not exists "team_member_id" uuid null;
    `)
    this.addSql(`
      alter table "taxi_fleet_monthly_settlements"
        add column if not exists "payout_percent" numeric(5,2) not null default 0;
    `)
    this.addSql(`
      alter table "taxi_fleet_monthly_settlements"
        add column if not exists "computed_distance_km" numeric(12,2) not null default 0;
    `)
    this.addSql(`
      alter table "taxi_fleet_monthly_settlements"
        add column if not exists "empty_distance_km" numeric(12,2) not null default 0;
    `)
    this.addSql(`
      alter table "taxi_fleet_monthly_settlements"
        add column if not exists "submitted_at" timestamptz null;
    `)
    this.addSql(`
      alter table "taxi_fleet_monthly_settlements"
        add column if not exists "closure_type" text null;
    `)
    this.addSql(`
      alter table "taxi_fleet_monthly_settlements"
        add column if not exists "closure_amount" numeric(14,2) null;
    `)
    this.addSql(`
      alter table "taxi_fleet_monthly_settlements"
        add column if not exists "closed_at" timestamptz null;
    `)

    this.addSql(`
      update "taxi_fleet_monthly_settlements"
      set "status" = 'approved'
      where "status" = 'closed';
    `)

    this.addSql(`
      alter table "taxi_fleet_monthly_settlements"
        drop constraint if exists "taxi_fleet_monthly_settlements_tenant_id_organization_id_month_start_unique";
    `)
    this.addSql(`
      alter table "taxi_fleet_monthly_settlements"
        drop constraint if exists "taxi_fleet_monthly_settlements_tenant_id_organizat_unique";
    `)

    // Placeholder UUID for soft-deleted legacy fleet rollups so NOT NULL + unique can apply.
    this.addSql(`
      update "taxi_fleet_monthly_settlements"
      set "team_member_id" = '00000000-0000-4000-8000-000000000000'
      where "team_member_id" is null;
    `)

    this.addSql(`
      alter table "taxi_fleet_monthly_settlements"
        alter column "team_member_id" set not null;
    `)

    this.addSql(`
      alter table "taxi_fleet_monthly_settlements"
        add constraint "taxi_fleet_monthly_settlements_tenant_org_member_month_unique"
        unique ("tenant_id", "organization_id", "team_member_id", "month_start");
    `)

    this.addSql(`
      create table if not exists "taxi_fleet_monthly_settlement_documents" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "month_start" date not null,
        "kind" text not null,
        "resource_id" uuid null,
        "attachment_id" uuid null,
        "file_name" text null,
        "parsed_json" jsonb null,
        "notes" text null,
        "uploaded_by_user_id" uuid null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        constraint "taxi_fleet_monthly_settlement_documents_pkey" primary key ("id")
      );
    `)
    this.addSql(`
      create index if not exists "taxi_fleet_monthly_settlement_documents_scope_idx"
        on "taxi_fleet_monthly_settlement_documents" ("tenant_id", "organization_id", "month_start");
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "taxi_fleet_monthly_settlement_documents" cascade;`)
    this.addSql(`
      alter table "taxi_fleet_monthly_settlements"
        drop constraint if exists "taxi_fleet_monthly_settlements_tenant_org_member_month_unique";
    `)
    this.addSql(`
      alter table "taxi_fleet_monthly_settlements"
        drop column if exists "closed_at",
        drop column if exists "closure_amount",
        drop column if exists "closure_type",
        drop column if exists "submitted_at",
        drop column if exists "empty_distance_km",
        drop column if exists "computed_distance_km",
        drop column if exists "payout_percent",
        drop column if exists "team_member_id";
    `)
    this.addSql(`
      alter table "taxi_fleet_monthly_settlements"
        add constraint "taxi_fleet_monthly_settlements_tenant_id_organization_id_month_start_unique"
        unique ("tenant_id", "organization_id", "month_start");
    `)
  }
}
