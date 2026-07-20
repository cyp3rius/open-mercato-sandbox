import { Migration } from '@mikro-orm/migrations'

export class Migration20260720133000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "sales_orders" add column if not exists "owner_user_id" uuid null;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "sales_orders" drop column if exists "owner_user_id";`,
    )
  }
}
