import { Migration } from '@mikro-orm/migrations'

/** Assigned handler (Open Mercato user) for the procurement process — row-level work permissions via procurement.processes.handle. */
export class Migration20260426120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "procurement_processes" add column "handler_user_id" uuid null;`,
    )
    this.addSql(
      `create index "procurement_processes_handler_user_idx" on "procurement_processes" ("handler_user_id");`,
    )
    this.addSql(
      `alter table "procurement_processes" add constraint "procurement_processes_handler_user_id_foreign" foreign key ("handler_user_id") references "users" ("id") on update cascade on delete set null;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "procurement_processes" drop constraint if exists "procurement_processes_handler_user_id_foreign";`,
    )
    this.addSql(`drop index if exists "procurement_processes_handler_user_idx";`)
    this.addSql(`alter table "procurement_processes" drop column if exists "handler_user_id";`)
  }
}
