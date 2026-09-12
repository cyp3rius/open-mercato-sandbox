import { Migration } from '@mikro-orm/migrations'

export class Migration20260713160000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "taxi_fleet_organization_settings" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "resource_type_id" uuid null,
        "default_payout_percent" numeric(5,2) not null default 0,
        "settings_json" jsonb null,
        "created_at" timestamptz(6) not null,
        "updated_at" timestamptz(6) not null,
        constraint "taxi_fleet_organization_settings_pkey" primary key ("id")
      );
    `)
    this.addSql(`
      create unique index if not exists "taxi_fleet_organization_settings_tenant_org_uidx"
      on "taxi_fleet_organization_settings" ("tenant_id", "organization_id");
    `)
    this.addSql(`
      create index if not exists "taxi_fleet_organization_settings_scope_idx"
      on "taxi_fleet_organization_settings" ("tenant_id", "organization_id");
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "taxi_fleet_organization_settings" cascade;`)
  }
}
