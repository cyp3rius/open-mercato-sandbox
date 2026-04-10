import { Migration } from '@mikro-orm/migrations'

export class Migration20260408150000_insurance_policy_insured_entities extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "insurance_policies" add column if not exists "insured_person_entity_id" uuid null;`,
    )
    this.addSql(
      `alter table "insurance_policies" add column if not exists "insured_company_entity_id" uuid null;`,
    )
    this.addSql(
      `create index if not exists "insurance_policies_insured_person_idx" on "insurance_policies" ("insured_person_entity_id");`,
    )
    this.addSql(
      `create index if not exists "insurance_policies_insured_company_idx" on "insurance_policies" ("insured_company_entity_id");`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "insurance_policies_insured_company_idx";`)
    this.addSql(`drop index if exists "insurance_policies_insured_person_idx";`)
    this.addSql(`alter table "insurance_policies" drop column if exists "insured_company_entity_id";`)
    this.addSql(`alter table "insurance_policies" drop column if exists "insured_person_entity_id";`)
  }
}
