import { Migration } from '@mikro-orm/migrations'

export class Migration20260408140000_insurance_leads extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "insurance_leads" (
        "id" uuid not null default gen_random_uuid(),
        "organization_id" uuid not null,
        "tenant_id" uuid not null,
        "title" text not null,
        "status" text not null default 'received',
        "source" text null,
        "external_id" text null,
        "payload" jsonb null,
        "referring_partner_entity_id" uuid null,
        "linked_policy_id" uuid null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        constraint "insurance_leads_pkey" primary key ("id")
      );
    `)
    this.addSql(
      `create index if not exists "insurance_leads_scope_idx" on "insurance_leads" ("organization_id", "tenant_id");`,
    )
    this.addSql(
      `create unique index if not exists "insurance_leads_external_scope_unique" on "insurance_leads" ("organization_id", "tenant_id", "external_id");`,
    )
    this.addSql(`
      alter table "insurance_leads"
      add constraint "insurance_leads_linked_policy_id_foreign"
      foreign key ("linked_policy_id") references "insurance_policies" ("id")
      on update cascade on delete set null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "insurance_leads" drop constraint if exists "insurance_leads_linked_policy_id_foreign";`)
    this.addSql(`drop index if exists "insurance_leads_external_scope_unique";`)
    this.addSql(`drop index if exists "insurance_leads_scope_idx";`)
    this.addSql(`drop table if exists "insurance_leads" cascade;`)
  }
}
