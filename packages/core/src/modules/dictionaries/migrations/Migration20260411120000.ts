import { Migration } from '@mikro-orm/migrations'

export class Migration20260411120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "dictionary_entries" add column "is_default" boolean not null default false;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "dictionary_entries" drop column if exists "is_default";`)
  }
}
