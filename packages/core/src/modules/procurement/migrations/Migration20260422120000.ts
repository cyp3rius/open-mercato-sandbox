import { Migration } from '@mikro-orm/migrations'

export class Migration20260422120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "procurement_organization_settings" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "default_process_status_value" text null,
        "created_at" timestamptz(6) not null,
        "updated_at" timestamptz(6) not null,
        "terminal_process_status_value" text null,
        constraint "procurement_organization_settings_pkey" primary key ("id")
      );
    `)
    this.addSql(
      `create index if not exists "procurement_org_settings_scope_idx" on "procurement_organization_settings" ("tenant_id", "organization_id");`,
    )
    this.addSql(
      `alter table if exists "procurement_organization_settings" drop constraint if exists "procurement_org_settings_scope_uidx";`,
    )
    this.addSql(
      `alter table "procurement_organization_settings" add constraint "procurement_org_settings_scope_uidx" unique ("tenant_id", "organization_id");`,
    )
    this.addSql(
      `alter table if exists "procurement_organization_settings" add column if not exists "terminal_process_status_value" text null;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "procurement_organization_settings" drop column if exists "terminal_process_status_value";`,
    )
  }
}
