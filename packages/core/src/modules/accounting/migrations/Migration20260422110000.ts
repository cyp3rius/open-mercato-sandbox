import { Migration } from '@mikro-orm/migrations'

export class Migration20260422110000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table "accounting_invoices" (
        "id" uuid not null default gen_random_uuid(),
        "organization_id" uuid not null,
        "tenant_id" uuid not null,
        "document_number" text not null,
        "document_kind" text not null,
        "issue_date" date not null,
        "sales_date" date null,
        "payment_due_date" date null,
        "payment_term_days" int null,
        "payment_method" text null,
        "payment_account" text null,
        "seller_entity_id" uuid null,
        "seller_name" text null,
        "seller_nip" text null,
        "seller_regon" text null,
        "seller_address" text null,
        "buyer_entity_id" uuid null,
        "buyer_name" text null,
        "buyer_nip" text null,
        "buyer_regon" text null,
        "buyer_address" text null,
        "line_items" jsonb null,
        "title" text null,
        "counterparty_name" text null,
        "external_reference" text null,
        "currency_code" text null,
        "total_amount" numeric(14,2) null,
        "source_system" text null,
        "notes" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "accounting_invoices_pkey" primary key ("id")
      );
    `)

    this.addSql(
      `create index "accounting_invoices_scope_idx" on "accounting_invoices" ("organization_id", "tenant_id");`,
    )
    this.addSql(`create index "accounting_invoices_kind_idx" on "accounting_invoices" ("document_kind");`)
    this.addSql(
      `create unique index "accounting_invoices_doc_number_unique" on "accounting_invoices" ("organization_id", "tenant_id", "document_number", "document_kind");`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "accounting_invoices" cascade;`)
  }
}
