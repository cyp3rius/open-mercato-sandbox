import { Migration } from '@mikro-orm/migrations'

export class Migration20260401190000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "insurance_insurers" (
        "id" uuid not null default gen_random_uuid(),
        "organization_id" uuid not null,
        "tenant_id" uuid not null,
        "code" text not null,
        "name" text not null,
        "description" text null,
        "is_active" boolean not null default true,
        "metadata" jsonb null,
        "created_at" timestamptz(6) not null,
        "updated_at" timestamptz(6) not null,
        "deleted_at" timestamptz(6) null,
        constraint "insurance_insurers_pkey" primary key ("id")
      );
    `)
    this.addSql(
      `create unique index if not exists "insurance_insurers_code_scope_unique" on "insurance_insurers" ("organization_id", "tenant_id", "code") where "deleted_at" is null;`,
    )
    this.addSql(
      `create index if not exists "insurance_insurers_scope_idx" on "insurance_insurers" ("organization_id", "tenant_id");`,
    )

    this.addSql(`
      create table if not exists "insurance_insurer_contacts" (
        "id" uuid not null default gen_random_uuid(),
        "organization_id" uuid not null,
        "tenant_id" uuid not null,
        "insurer_id" uuid not null,
        "full_name" text not null,
        "email" text null,
        "phone" text null,
        "role" text null,
        "is_default" boolean not null default false,
        "is_active" boolean not null default true,
        "created_at" timestamptz(6) not null,
        "updated_at" timestamptz(6) not null,
        "deleted_at" timestamptz(6) null,
        constraint "insurance_insurer_contacts_pkey" primary key ("id"),
        constraint "insurance_insurer_contacts_insurer_fk" foreign key ("insurer_id") references "insurance_insurers" ("id") on update cascade on delete cascade
      );
    `)
    this.addSql(
      `create index if not exists "insurance_insurer_contacts_insurer_idx" on "insurance_insurer_contacts" ("insurer_id", "organization_id", "tenant_id");`,
    )

    this.addSql(`
      create table if not exists "insurance_policies" (
        "id" uuid not null default gen_random_uuid(),
        "organization_id" uuid not null,
        "tenant_id" uuid not null,
        "policy_number" text not null,
        "insurer_id" uuid not null,
        "insurer_contact_id" uuid null,
        "referring_partner_entity_id" uuid not null,
        "catalog_product_id" uuid null,
        "valid_from" timestamptz(6) null,
        "valid_to" timestamptz(6) null,
        "status" text null,
        "metadata" jsonb null,
        "created_at" timestamptz(6) not null,
        "updated_at" timestamptz(6) not null,
        "deleted_at" timestamptz(6) null,
        constraint "insurance_policies_pkey" primary key ("id"),
        constraint "insurance_policies_insurer_fk" foreign key ("insurer_id") references "insurance_insurers" ("id") on update cascade on delete restrict,
        constraint "insurance_policies_insurer_contact_fk" foreign key ("insurer_contact_id") references "insurance_insurer_contacts" ("id") on update cascade on delete set null
      );
    `)
    this.addSql(
      `create index if not exists "insurance_policies_scope_idx" on "insurance_policies" ("organization_id", "tenant_id");`,
    )
    this.addSql(
      `create index if not exists "insurance_policies_partner_idx" on "insurance_policies" ("referring_partner_entity_id");`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "insurance_policies" cascade;`)
    this.addSql(`drop table if exists "insurance_insurer_contacts" cascade;`)
    this.addSql(`drop table if exists "insurance_insurers" cascade;`)
  }
}
