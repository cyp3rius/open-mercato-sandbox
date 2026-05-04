import { Migration } from '@mikro-orm/migrations';

export class Migration20260503091947 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "inbox_emails" add column if not exists "case_id" uuid null;`)
    this.addSql(
      `create index if not exists "inbox_emails_case_id_index" on "inbox_emails" ("case_id");`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "inbox_emails_case_id_index";`)
    this.addSql(`alter table "inbox_emails" drop column if exists "case_id";`)
  }

}
