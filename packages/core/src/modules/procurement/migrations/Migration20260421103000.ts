import { Migration } from '@mikro-orm/migrations'

export class Migration20260421103000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "procurement_process_suppliers" add column "vendor_customer_entity_id" uuid null;`,
    )
    this.addSql(
      `create index "procurement_process_suppliers_vendor_customer_entity_idx" on "procurement_process_suppliers" ("vendor_customer_entity_id");`,
    )
    this.addSql(
      `alter table "procurement_process_suppliers" add constraint "procurement_process_suppliers_vendor_customer_entity_id_foreign" foreign key ("vendor_customer_entity_id") references "customer_entities" ("id") on update cascade on delete set null;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "procurement_process_suppliers" drop constraint if exists "procurement_process_suppliers_vendor_customer_entity_id_foreign";`,
    )
    this.addSql(`drop index if exists "procurement_process_suppliers_vendor_customer_entity_idx";`)
    this.addSql(
      `alter table "procurement_process_suppliers" drop column if exists "vendor_customer_entity_id";`,
    )
  }
}
