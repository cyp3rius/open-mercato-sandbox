import { Migration } from '@mikro-orm/migrations'

const PROCUREMENT_CONTEXT = 'procurement_process'

/** Moves procurement follow-up tasks into polymorphic `operations_tasks` (same UUIDs). */
export class Migration20260502200000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "operations_tasks" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "context_type" text not null, "context_id" uuid not null, "supplier_id" uuid null, "title" text not null, "body" text null, "task_status" text not null default 'open', "due_at" timestamptz null, "assigned_user_id" uuid null, "delegated_from_user_id" uuid null, "source_action_value" text null, "work_item_user_task_id" uuid null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "operations_tasks_pkey" primary key ("id"));`,
    )
    this.addSql(
      `create index "operations_tasks_context_idx" on "operations_tasks" ("tenant_id", "organization_id", "context_type", "context_id");`,
    )
    this.addSql(
      `create index "operations_tasks_assignee_idx" on "operations_tasks" ("assigned_user_id");`,
    )
    this.addSql(
      `insert into "operations_tasks" ("id", "tenant_id", "organization_id", "context_type", "context_id", "supplier_id", "title", "body", "task_status", "due_at", "assigned_user_id", "delegated_from_user_id", "source_action_value", "work_item_user_task_id", "created_at", "updated_at", "deleted_at") select "id", "tenant_id", "organization_id", '${PROCUREMENT_CONTEXT}', "process_id", "supplier_id", "title", "body", "task_status", "due_at", "assigned_user_id", "delegated_from_user_id", "source_action_value", "work_item_user_task_id", "created_at", "updated_at", "deleted_at" from "procurement_process_tasks";`,
    )
    this.addSql(`drop table if exists "procurement_process_tasks" cascade;`)
  }

  override async down(): Promise<void> {
    this.addSql(
      `create table "procurement_process_tasks" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "process_id" uuid not null, "supplier_id" uuid null, "title" text not null, "body" text null, "task_status" text not null default 'open', "due_at" timestamptz null, "assigned_user_id" uuid null, "delegated_from_user_id" uuid null, "source_action_value" text null, "work_item_user_task_id" uuid null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "procurement_process_tasks_pkey" primary key ("id"));`,
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
      `insert into "procurement_process_tasks" ("id", "tenant_id", "organization_id", "process_id", "supplier_id", "title", "body", "task_status", "due_at", "assigned_user_id", "delegated_from_user_id", "source_action_value", "work_item_user_task_id", "created_at", "updated_at", "deleted_at") select "id", "tenant_id", "organization_id", "context_id", "supplier_id", "title", "body", "task_status", "due_at", "assigned_user_id", "delegated_from_user_id", "source_action_value", "work_item_user_task_id", "created_at", "updated_at", "deleted_at" from "operations_tasks" where "context_type" = '${PROCUREMENT_CONTEXT}';`,
    )
    this.addSql(`drop table if exists "operations_tasks" cascade;`)
  }
}
