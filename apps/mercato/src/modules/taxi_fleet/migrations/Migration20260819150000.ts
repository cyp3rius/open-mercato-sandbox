import { Migration } from '@mikro-orm/migrations'

export class Migration20260819150000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "taxi_fleet_weekly_settlements"
        add column if not exists "closure_type" text null,
        add column if not exists "closure_amount" numeric(14,2) null,
        add column if not exists "closed_at" timestamptz null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table "taxi_fleet_weekly_settlements"
        drop column if exists "closure_type",
        drop column if exists "closure_amount",
        drop column if exists "closed_at";
    `)
  }
}
