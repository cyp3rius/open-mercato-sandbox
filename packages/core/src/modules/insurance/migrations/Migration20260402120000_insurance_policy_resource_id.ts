import { Migration } from '@mikro-orm/migrations'

export class Migration20260402120000_insurance_policy_resource_id extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "insurance_policies" add column if not exists "resource_id" uuid null;`,
    )
    this.addSql(
      `create index if not exists "insurance_policies_resource_idx" on "insurance_policies" ("resource_id");`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "insurance_policies_resource_idx";`)
    this.addSql(`alter table "insurance_policies" drop column if exists "resource_id";`)
  }
}
