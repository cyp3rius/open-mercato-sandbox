import { Migration } from '@mikro-orm/migrations'

export class Migration20260423120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "procurement_process_line_items" add column "supplier_id" uuid null;`,
    )
    this.addSql(
      `create index "procurement_process_line_items_supplier_idx" on "procurement_process_line_items" ("supplier_id");`,
    )
    this.addSql(
      `alter table "procurement_process_line_items" add constraint "procurement_process_line_items_supplier_id_foreign" foreign key ("supplier_id") references "procurement_process_suppliers" ("id") on update cascade on delete set null;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "procurement_process_line_items" drop constraint if exists "procurement_process_line_items_supplier_id_foreign";`,
    )
    this.addSql(`drop index if exists "procurement_process_line_items_supplier_idx";`)
    this.addSql(`alter table "procurement_process_line_items" drop column if exists "supplier_id";`)
  }
}
