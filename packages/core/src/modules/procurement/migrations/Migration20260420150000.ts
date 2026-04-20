import { Migration } from '@mikro-orm/migrations'

export class Migration20260420150000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "procurement_process_status_transitions" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "from_status_value" text not null, "to_status_value" text not null, "automation_workflow_id" text null, "sort_order" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "procurement_process_status_transitions_pkey" primary key ("id"));`,
    )
    this.addSql(
      `create unique index "procurement_status_transitions_scope_from_to_uidx" on "procurement_process_status_transitions" ("tenant_id", "organization_id", "from_status_value", "to_status_value");`,
    )
    this.addSql(
      `create index "procurement_status_transitions_scope_idx" on "procurement_process_status_transitions" ("tenant_id", "organization_id");`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "procurement_process_status_transitions" cascade;`)
  }
}
