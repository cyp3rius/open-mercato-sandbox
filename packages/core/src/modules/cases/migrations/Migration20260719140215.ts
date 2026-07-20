import { Migration } from '@mikro-orm/migrations'

export class Migration20260719140215 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "cases_cases" alter column "customer_entity_id" drop not null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "cases_cases" alter column "customer_entity_id" set not null;`)
  }
}
