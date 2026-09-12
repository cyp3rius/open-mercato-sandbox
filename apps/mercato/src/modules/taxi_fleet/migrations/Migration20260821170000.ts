import { Migration } from '@mikro-orm/migrations'

export class Migration20260821170000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "taxi_fleet_receipt_extractions"
      add column if not exists "ocr_vat_rate_percent" numeric(5,2) null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table "taxi_fleet_receipt_extractions"
      drop column if exists "ocr_vat_rate_percent";
    `)
  }
}
