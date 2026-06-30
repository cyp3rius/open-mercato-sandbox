import { Migration } from '@mikro-orm/migrations'

/** Optional outcome resource per specification line (at most one per line). */
export class Migration20260425120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "procurement_process_line_items" add column if not exists "resource_id" uuid null;`,
    )
    this.addSql(
      `create index if not exists "procurement_process_line_items_resource_idx" on "procurement_process_line_items" ("resource_id");`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "procurement_process_line_items" drop constraint if exists "procurement_process_line_items_resource_id_foreign";`,
    )
    this.addSql(`drop index if exists "procurement_process_line_items_resource_idx";`)
    this.addSql(
      `alter table if exists "procurement_process_line_items" drop column if exists "resource_id";`,
    )
  }
}
