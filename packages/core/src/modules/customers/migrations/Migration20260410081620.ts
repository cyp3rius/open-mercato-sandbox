import { Migration } from '@mikro-orm/migrations'

export class Migration20260410081620 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "customer_entities" add column if not exists "crm_record_type" text not null default 'customer';`,
    )
    this.addSql(`alter table "customer_entities" add column if not exists "referral_code" text null;`)
    this.addSql(
      `create index if not exists "customer_entities_crm_record_type_idx" on "customer_entities" ("organization_id", "tenant_id", "crm_record_type");`,
    )

    this.addSql(
      `alter table "customer_people" add column if not exists "pesel" text null, add column if not exists "residence_street" text null, add column if not exists "residence_postal_code" text null, add column if not exists "residence_city" text null, add column if not exists "residence_country" text null;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "customer_entities_crm_record_type_idx";`)
    this.addSql(
      `alter table "customer_entities" drop column if exists "crm_record_type", drop column if exists "referral_code";`,
    )

    this.addSql(
      `alter table "customer_people" drop column if exists "pesel", drop column if exists "residence_street", drop column if exists "residence_postal_code", drop column if exists "residence_city", drop column if exists "residence_country";`,
    )
  }
}
