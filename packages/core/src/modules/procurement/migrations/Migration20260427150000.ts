import { Migration } from '@mikro-orm/migrations'

/** Links procurement tasks to synced customer interactions / example todos for work-plan lists. */
export class Migration20260427150000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "procurement_process_tasks" add column "work_item_customer_interaction_id" uuid null;`,
    )
    this.addSql(
      `alter table "procurement_process_tasks" add column "work_item_example_todo_id" uuid null;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "procurement_process_tasks" drop column if exists "work_item_example_todo_id";`,
    )
    this.addSql(
      `alter table "procurement_process_tasks" drop column if exists "work_item_customer_interaction_id";`,
    )
  }
}
