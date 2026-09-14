import { Migration } from '@mikro-orm/migrations'

export class Migration20260914140000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "taxi_fleet_financial_entries"
        add column if not exists "resource_id" uuid null;
    `)
    this.addSql(`
      create index if not exists "taxi_fleet_financial_entries_resource_idx"
        on "taxi_fleet_financial_entries" ("resource_id");
    `)
    this.addSql(`
      alter table "taxi_fleet_receipt_extractions"
        add column if not exists "ocr_registration_plate" text null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      drop index if exists "taxi_fleet_financial_entries_resource_idx";
    `)
    this.addSql(`
      alter table "taxi_fleet_financial_entries"
        drop column if exists "resource_id";
    `)
    this.addSql(`
      alter table "taxi_fleet_receipt_extractions"
        drop column if exists "ocr_registration_plate";
    `)
  }
}
