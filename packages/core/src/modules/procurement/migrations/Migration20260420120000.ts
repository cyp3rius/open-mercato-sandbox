import { Migration } from '@mikro-orm/migrations'

export class Migration20260420120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "procurement_processes" add column "refinancing_enabled" bool not null default false;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "procurement_processes" drop column if exists "refinancing_enabled";`)
  }
}
