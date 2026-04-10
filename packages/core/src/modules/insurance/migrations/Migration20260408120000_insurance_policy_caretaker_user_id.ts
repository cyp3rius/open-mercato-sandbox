import { Migration } from '@mikro-orm/migrations'

export class Migration20260408120000_insurance_policy_caretaker_user_id extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "insurance_policies" add column if not exists "caretaker_user_id" uuid null;`,
    )
    this.addSql(
      `create index if not exists "insurance_policies_caretaker_user_idx" on "insurance_policies" ("caretaker_user_id");`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "insurance_policies_caretaker_user_idx";`)
    this.addSql(`alter table "insurance_policies" drop column if exists "caretaker_user_id";`)
  }
}
