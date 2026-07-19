import { Migration } from '@mikro-orm/migrations'

export class Migration20260718170000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "catalog_customer_offerings" add column if not exists "parent_offering_id" uuid null;`,
    )
    this.addSql(
      `create index if not exists "catalog_customer_offerings_parent_idx" on "catalog_customer_offerings" ("parent_offering_id");`,
    )
    this.addSql(
      `drop index if exists "catalog_customer_offerings_order_line_unique";`,
    )
    this.addSql(
      `create unique index if not exists "catalog_customer_offerings_line_product_unique" on "catalog_customer_offerings" ("sales_order_line_id", "product_id");`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `drop index if exists "catalog_customer_offerings_line_product_unique";`,
    )
    this.addSql(
      `create unique index if not exists "catalog_customer_offerings_order_line_unique" on "catalog_customer_offerings" ("sales_order_line_id");`,
    )
    this.addSql(
      `drop index if exists "catalog_customer_offerings_parent_idx";`,
    )
    this.addSql(
      `alter table "catalog_customer_offerings" drop column if exists "parent_offering_id";`,
    )
  }
}
