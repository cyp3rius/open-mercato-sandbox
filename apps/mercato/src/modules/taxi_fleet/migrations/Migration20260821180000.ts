import { Migration } from '@mikro-orm/migrations'

export class Migration20260821180000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "taxi_fleet_financial_entries"
      add column if not exists "document_nip" text null,
      add column if not exists "is_document_duplicate" boolean not null default false,
      add column if not exists "duplicate_of_entry_id" uuid null;
    `)
    this.addSql(`
      create index if not exists "taxi_fleet_financial_entries_duplicate_idx"
      on "taxi_fleet_financial_entries" ("tenant_id", "organization_id", "is_document_duplicate");
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "taxi_fleet_financial_entries_duplicate_idx";`)
    this.addSql(`
      alter table "taxi_fleet_financial_entries"
      drop column if exists "document_nip",
      drop column if exists "is_document_duplicate",
      drop column if exists "duplicate_of_entry_id";
    `)
  }
}
