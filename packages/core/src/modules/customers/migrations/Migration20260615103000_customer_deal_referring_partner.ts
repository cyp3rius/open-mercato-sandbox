import { Migration } from '@mikro-orm/migrations'

export class Migration20260615103000_customer_deal_referring_partner extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "customer_deals" add column "external_id" text null;`)
    this.addSql(`alter table "customer_deals" add column "payload" jsonb null;`)
    this.addSql(`alter table "customer_deals" add column "referring_partner_entity_id" uuid null;`)
    this.addSql(
      `create unique index "customer_deals_external_scope_unique" on "customer_deals" ("organization_id", "tenant_id", "external_id") where "external_id" is not null and "deleted_at" is null;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "customer_deals_external_scope_unique";`)
    this.addSql(`alter table "customer_deals" drop column if exists "referring_partner_entity_id";`)
    this.addSql(`alter table "customer_deals" drop column if exists "payload";`)
    this.addSql(`alter table "customer_deals" drop column if exists "external_id";`)
  }
}
