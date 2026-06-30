import { Migration } from '@mikro-orm/migrations'

export class Migration20260421120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "procurement_processes" add column "refinancing_line_item_id" uuid null;`,
    )
    this.addSql(
      `alter table "procurement_processes" add constraint "procurement_processes_refinancing_line_item_id_foreign" foreign key ("refinancing_line_item_id") references "procurement_process_line_items" ("id") on update cascade on delete set null;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "procurement_processes" drop constraint if exists "procurement_processes_refinancing_line_item_id_foreign";`,
    )
    this.addSql(`alter table "procurement_processes" drop column if exists "refinancing_line_item_id";`)
  }
}
