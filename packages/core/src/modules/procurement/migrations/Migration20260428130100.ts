import { Migration } from '@mikro-orm/migrations'

/** Procurement tasks sync to workflows `user_tasks` instead of CRM interactions / example todos. */
export class Migration20260428130100 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "procurement_process_tasks" add column "work_item_user_task_id" uuid null;`,
    )
    this.addSql(
      `alter table "procurement_process_tasks" drop column if exists "work_item_customer_interaction_id";`,
    )
    this.addSql(
      `alter table "procurement_process_tasks" drop column if exists "work_item_example_todo_id";`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "procurement_process_tasks" drop column if exists "work_item_user_task_id";`,
    )
    this.addSql(
      `alter table "procurement_process_tasks" add column "work_item_customer_interaction_id" uuid null;`,
    )
    this.addSql(
      `alter table "procurement_process_tasks" add column "work_item_example_todo_id" uuid null;`,
    )
  }
}
