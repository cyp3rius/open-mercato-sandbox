import { Migration } from '@mikro-orm/migrations'

export class Migration20260720102400 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "sales_settings" add column if not exists "subscription_activation_order_statuses" jsonb null;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "sales_settings" drop column if exists "subscription_activation_order_statuses";`,
    )
  }
}
