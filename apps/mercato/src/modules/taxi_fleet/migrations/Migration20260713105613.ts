import { Migration } from '@mikro-orm/migrations'

/**
 * Originally a bad MikroORM snapshot dump that dropped unrelated procurement/resources FKs.
 * Trimmed to the only intended change: create taxi_fleet_financial_entries.
 */
export class Migration20260713105613 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "taxi_fleet_financial_entries" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "team_member_id" uuid not null,
        "kind" text not null,
        "income_document_type" text null,
        "cost_type" text null,
        "trip_id" uuid null,
        "customer_person_id" uuid null,
        "customer_company_id" uuid null,
        "amount" numeric(14,2) not null,
        "currency_code" text not null default 'PLN',
        "document_number" text null,
        "occurred_at" timestamptz not null,
        "receipt_attachment_id" uuid null,
        "notes" text null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        constraint "taxi_fleet_financial_entries_pkey" primary key ("id")
      );
    `)
    this.addSql(
      `create index if not exists "taxi_fleet_financial_entries_occurred_idx" on "taxi_fleet_financial_entries" ("occurred_at", "tenant_id");`,
    )
    this.addSql(
      `create index if not exists "taxi_fleet_financial_entries_member_idx" on "taxi_fleet_financial_entries" ("team_member_id", "tenant_id");`,
    )
    this.addSql(
      `create index if not exists "taxi_fleet_financial_entries_scope_idx" on "taxi_fleet_financial_entries" ("tenant_id", "organization_id");`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "taxi_fleet_financial_entries" cascade;`)
  }
}
