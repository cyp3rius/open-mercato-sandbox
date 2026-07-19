import { Migration } from '@mikro-orm/migrations'

export class Migration20260718160000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "catalog_products" add column if not exists "offering_kind" text not null default 'internal_service', add column if not exists "case_templates" jsonb null;`,
    )
    this.addSql(`
      create table if not exists "catalog_customer_offerings" (
        "id" uuid not null default gen_random_uuid(),
        "organization_id" uuid not null,
        "tenant_id" uuid not null,
        "customer_entity_id" uuid not null,
        "product_id" uuid not null,
        "sales_order_id" uuid not null,
        "sales_order_line_id" uuid not null,
        "offering_kind" text not null,
        "status" text not null default 'pending',
        "starts_at" timestamptz null,
        "ends_at" timestamptz null,
        "activated_at" timestamptz null,
        "case_templates_snapshot" jsonb null,
        "spawned_case_ids" jsonb null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        constraint "catalog_customer_offerings_pkey" primary key ("id")
      );
    `)
    this.addSql(
      `create index if not exists "catalog_customer_offerings_scope_idx" on "catalog_customer_offerings" ("organization_id", "tenant_id");`,
    )
    this.addSql(
      `create index if not exists "catalog_customer_offerings_customer_idx" on "catalog_customer_offerings" ("customer_entity_id");`,
    )
    this.addSql(
      `create index if not exists "catalog_customer_offerings_status_starts_idx" on "catalog_customer_offerings" ("status", "starts_at");`,
    )
    this.addSql(
      `create unique index if not exists "catalog_customer_offerings_order_line_unique" on "catalog_customer_offerings" ("sales_order_line_id");`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "catalog_customer_offerings" cascade;`)
    this.addSql(
      `alter table "catalog_products" drop column if exists "offering_kind", drop column if exists "case_templates";`,
    )
  }
}
