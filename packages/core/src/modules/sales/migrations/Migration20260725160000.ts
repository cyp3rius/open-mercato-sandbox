import { Migration } from '@mikro-orm/migrations'

export class Migration20260725160000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "sales_quote_lines" add column if not exists "subscription_starts_at" timestamptz null, add column if not exists "subscription_ends_at" timestamptz null;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "sales_quote_lines" drop column if exists "subscription_starts_at", drop column if exists "subscription_ends_at";`,
    )
  }
}
