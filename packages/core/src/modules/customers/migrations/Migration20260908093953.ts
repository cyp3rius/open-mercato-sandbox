import { Migration } from '@mikro-orm/migrations'

export class Migration20260908093953 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "customer_companies" add column "bank_name" text null, add column "iban" text null;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "customer_companies" drop column "bank_name", drop column "iban";`)
  }
}
