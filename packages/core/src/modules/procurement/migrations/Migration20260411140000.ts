import { Migration } from '@mikro-orm/migrations'

export class Migration20260411140000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "procurement_processes" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "title" text not null, "description" text null, "started_at" timestamptz null, "status_value" text null, "status_label" text null, "status_color" text null, "status_icon" text null, "type_value" text null, "type_label" text null, "type_color" text null, "type_icon" text null, "customer_entity_id" uuid null, "sales_quote_id" uuid null, "sales_invoice_id" uuid null, "resource_id" uuid null, "selected_supplier_id" uuid null, "refinancing_notes" text null, "closed_at" timestamptz null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "procurement_processes_pkey" primary key ("id"));`,
    )
    this.addSql(
      `create index "procurement_processes_scope_idx" on "procurement_processes" ("tenant_id", "organization_id");`,
    )
    this.addSql(
      `create index "procurement_processes_customer_idx" on "procurement_processes" ("customer_entity_id");`,
    )
    this.addSql(
      `create index "procurement_processes_resource_idx" on "procurement_processes" ("resource_id");`,
    )

    this.addSql(
      `create table "procurement_process_suppliers" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "process_id" uuid not null, "vendor_label" text not null, "contact_name" text null, "email" text null, "phone" text null, "website" text null, "notes" text null, "offer_summary" text null, "sort_order" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "procurement_process_suppliers_pkey" primary key ("id"));`,
    )
    this.addSql(
      `create index "procurement_process_suppliers_process_idx" on "procurement_process_suppliers" ("process_id");`,
    )
    this.addSql(
      `create index "procurement_process_suppliers_scope_idx" on "procurement_process_suppliers" ("tenant_id", "organization_id");`,
    )
    this.addSql(
      `alter table "procurement_process_suppliers" add constraint "procurement_process_suppliers_process_id_foreign" foreign key ("process_id") references "procurement_processes" ("id") on update cascade;`,
    )

    this.addSql(
      `create table "procurement_process_line_items" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "process_id" uuid not null, "title" text not null, "specification" text null, "quantity" double precision null, "unit_label" text null, "sort_order" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "procurement_process_line_items_pkey" primary key ("id"));`,
    )
    this.addSql(
      `create index "procurement_process_line_items_process_idx" on "procurement_process_line_items" ("process_id");`,
    )
    this.addSql(
      `alter table "procurement_process_line_items" add constraint "procurement_process_line_items_process_id_foreign" foreign key ("process_id") references "procurement_processes" ("id") on update cascade;`,
    )

    this.addSql(
      `create table "procurement_process_tasks" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "process_id" uuid not null, "supplier_id" uuid null, "title" text not null, "body" text null, "task_status" text not null default 'open', "due_at" timestamptz null, "assigned_user_id" uuid null, "delegated_from_user_id" uuid null, "source_action_value" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "procurement_process_tasks_pkey" primary key ("id"));`,
    )
    this.addSql(
      `create index "procurement_process_tasks_process_idx" on "procurement_process_tasks" ("process_id");`,
    )
    this.addSql(
      `create index "procurement_process_tasks_assignee_idx" on "procurement_process_tasks" ("assigned_user_id");`,
    )
    this.addSql(
      `alter table "procurement_process_tasks" add constraint "procurement_process_tasks_process_id_foreign" foreign key ("process_id") references "procurement_processes" ("id") on update cascade;`,
    )
    this.addSql(
      `alter table "procurement_process_tasks" add constraint "procurement_process_tasks_supplier_id_foreign" foreign key ("supplier_id") references "procurement_process_suppliers" ("id") on update cascade on delete set null;`,
    )

    this.addSql(
      `create table "procurement_process_timeline_events" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "process_id" uuid not null, "event_type" text not null, "message" text not null, "actor_user_id" uuid null, "metadata" jsonb null, "created_at" timestamptz not null, constraint "procurement_process_timeline_events_pkey" primary key ("id"));`,
    )
    this.addSql(
      `create index "procurement_timeline_process_idx" on "procurement_process_timeline_events" ("process_id");`,
    )
    this.addSql(
      `alter table "procurement_process_timeline_events" add constraint "procurement_process_timeline_events_process_id_foreign" foreign key ("process_id") references "procurement_processes" ("id") on update cascade;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "procurement_process_timeline_events" cascade;`)
    this.addSql(`drop table if exists "procurement_process_tasks" cascade;`)
    this.addSql(`drop table if exists "procurement_process_line_items" cascade;`)
    this.addSql(`drop table if exists "procurement_process_suppliers" cascade;`)
    this.addSql(`drop table if exists "procurement_processes" cascade;`)
  }
}
