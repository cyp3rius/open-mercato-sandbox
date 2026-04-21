import { Migration } from '@mikro-orm/migrations'

/** Standalone user tasks linked to procurement (nullable workflow/step). */
export class Migration20260428130000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "user_tasks" alter column "workflow_instance_id" drop not null;`)
    this.addSql(`alter table "user_tasks" alter column "step_instance_id" drop not null;`)
    this.addSql(
      `alter table "user_tasks" add column "procurement_process_task_id" uuid null;`,
    )
    this.addSql(`alter table "user_tasks" add column "procurement_process_id" uuid null;`)
    this.addSql(
      `create unique index "user_tasks_procurement_process_task_unique" on "user_tasks" ("procurement_process_task_id") where "procurement_process_task_id" is not null;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "user_tasks_procurement_process_task_unique";`)
    this.addSql(`alter table "user_tasks" drop column if exists "procurement_process_id";`)
    this.addSql(`alter table "user_tasks" drop column if exists "procurement_process_task_id";`)
    this.addSql(`alter table "user_tasks" alter column "step_instance_id" set not null;`)
    this.addSql(`alter table "user_tasks" alter column "workflow_instance_id" set not null;`)
  }
}
