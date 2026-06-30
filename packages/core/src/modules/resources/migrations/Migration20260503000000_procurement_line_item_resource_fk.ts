import { Migration } from '@mikro-orm/migrations'

/** FK deferred from procurement — resources module migrates after procurement on fresh installs. */
export class Migration20260503000000_procurement_line_item_resource_fk extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "procurement_process_line_items" drop constraint if exists "procurement_process_line_items_resource_id_foreign";`,
    )
    this.addSql(
      `alter table if exists "procurement_process_line_items" add constraint "procurement_process_line_items_resource_id_foreign" foreign key ("resource_id") references "resources_resources" ("id") on update cascade on delete set null;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "procurement_process_line_items" drop constraint if exists "procurement_process_line_items_resource_id_foreign";`,
    )
  }
}
