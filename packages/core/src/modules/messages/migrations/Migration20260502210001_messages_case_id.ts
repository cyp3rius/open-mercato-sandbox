import { Migration } from '@mikro-orm/migrations'

export class Migration20260502210001_messages_case_id extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "messages" add column if not exists "case_id" uuid null;`)
    this.addSql(`create index if not exists "messages_case_idx" on "messages" ("case_id");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "messages_case_idx";`)
    this.addSql(`alter table "messages" drop column if exists "case_id";`)
  }
}
