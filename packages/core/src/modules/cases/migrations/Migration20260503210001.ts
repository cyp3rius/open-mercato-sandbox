import { Migration } from '@mikro-orm/migrations'

export class Migration20260503210001 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "cases_cases" add column "insurance_policy_id" uuid null;`)
    this.addSql(
      `create index "cases_cases_insurance_policy_idx" on "cases_cases" ("insurance_policy_id");`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "cases_cases_insurance_policy_idx";`);
    this.addSql(`alter table "cases_cases" drop column "insurance_policy_id";`)
  }
}
