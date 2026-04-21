import { Migration } from '@mikro-orm/migrations'

export class Migration20260421120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "procurement_organization_settings" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "default_process_status_value" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "procurement_organization_settings_pkey" primary key ("id"));`,
    )
    this.addSql(
      `create unique index "procurement_org_settings_scope_uidx" on "procurement_organization_settings" ("tenant_id", "organization_id");`,
    )
    this.addSql(
      `create index "procurement_org_settings_scope_idx" on "procurement_organization_settings" ("tenant_id", "organization_id");`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "procurement_organization_settings" cascade;`)
  }
}
