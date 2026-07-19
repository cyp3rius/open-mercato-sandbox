import { Migration } from '@mikro-orm/migrations'

export class Migration20260718160100 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "sales_order_lines" add column if not exists "subscription_starts_at" timestamptz null, add column if not exists "subscription_ends_at" timestamptz null;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "sales_order_lines" drop column if exists "subscription_starts_at", drop column if exists "subscription_ends_at";`,
    )
  }
}
