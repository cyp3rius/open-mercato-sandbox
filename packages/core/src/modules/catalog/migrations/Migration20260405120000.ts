import { Migration } from '@mikro-orm/migrations'

export class Migration20260405120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "catalog_product_service_line_extensions" add column if not exists "attributes" jsonb null;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "catalog_product_service_line_extensions" drop column if exists "attributes";`,
    )
  }
}
