import { Migration } from '@mikro-orm/migrations'

export class Migration20260408180000_customer_crm_record_type extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "customer_entities" add column if not exists "crm_record_type" text not null default 'customer';`,
    )
    this.addSql(
      `alter table "customer_entities" add column if not exists "referral_code" text null;`,
    )
    this.addSql(
      `create index if not exists "customer_entities_crm_record_type_idx" on "customer_entities" ("organization_id", "tenant_id", "crm_record_type");`,
    )
    this.addSql(
      `create unique index if not exists "customer_entities_referral_code_scope_unique" on "customer_entities" ("organization_id", "tenant_id", "referral_code");`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "customer_entities_referral_code_scope_unique";`)
    this.addSql(`drop index if exists "customer_entities_crm_record_type_idx";`)
    this.addSql(`alter table "customer_entities" drop column if exists "referral_code";`)
    this.addSql(`alter table "customer_entities" drop column if exists "crm_record_type";`)
  }
}
