import { Migration } from '@mikro-orm/migrations'

export class Migration20260408120000_company_nip_regon extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "customer_companies" add column if not exists "nip" text null, add column if not exists "regon" text null;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "customer_companies" drop column if exists "nip", drop column if exists "regon";`)
  }
}
