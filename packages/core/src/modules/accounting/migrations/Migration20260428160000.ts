import { Migration } from '@mikro-orm/migrations'

export class Migration20260428160000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "accounting_invoices" add column "is_draft" bool not null default false;`,
    )
    this.addSql(
      `create index "accounting_invoices_draft_idx" on "accounting_invoices" ("organization_id", "tenant_id", "is_draft");`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "accounting_invoices_draft_idx";`)
    this.addSql(`alter table "accounting_invoices" drop column if exists "is_draft";`)
  }
}
