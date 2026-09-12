import { Migration } from '@mikro-orm/migrations'

export class Migration20260826210000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "taxi_fleet_receipt_extractions"
      add column if not exists "ocr_distance_km" numeric(12,2) null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table "taxi_fleet_receipt_extractions"
      drop column if exists "ocr_distance_km";
    `)
  }
}
