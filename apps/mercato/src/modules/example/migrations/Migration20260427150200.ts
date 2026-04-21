import { Migration } from '@mikro-orm/migrations'

/** Procurement reference on general (example) todos. */
export class Migration20260427150200 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "todos" add column "procurement_process_id" uuid null;`)
    this.addSql(`alter table "todos" add column "procurement_process_task_id" uuid null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "todos" drop column if exists "procurement_process_task_id";`)
    this.addSql(`alter table "todos" drop column if exists "procurement_process_id";`)
  }
}
