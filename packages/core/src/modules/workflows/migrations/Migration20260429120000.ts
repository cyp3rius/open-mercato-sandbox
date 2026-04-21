import { Migration } from '@mikro-orm/migrations'

/** Denormalized process title for /backend/tasks UI. */
export class Migration20260429120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "user_tasks" add column "procurement_process_title" varchar(500) null;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "user_tasks" drop column if exists "procurement_process_title";`)
  }
}
