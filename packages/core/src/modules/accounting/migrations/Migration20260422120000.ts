import { Migration } from '@mikro-orm/migrations'

export class Migration20260422120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table "accounting_selling_entities" (
        "id" uuid not null default gen_random_uuid(),
        "organization_id" uuid not null,
        "tenant_id" uuid not null,
        "name" text not null,
        "nip" text null,
        "regon" text null,
        "address" text null,
        "bank_accounts" jsonb null,
        "invoice_numbering_mode" text not null,
        "invoice_numbering_custom" text null,
        "next_invoice_seq" int not null default 1,
        "invoice_seq_year" int null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "accounting_selling_entities_pkey" primary key ("id")
      );
    `)
    this.addSql(
      `create index "accounting_selling_entities_scope_idx" on "accounting_selling_entities" ("organization_id", "tenant_id");`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "accounting_selling_entities" cascade;`)
  }
}
