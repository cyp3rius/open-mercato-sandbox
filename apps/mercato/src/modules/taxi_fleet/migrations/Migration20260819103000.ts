import { Migration } from '@mikro-orm/migrations'

export class Migration20260819103000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "taxi_fleet_trips"
        add column if not exists "platform" text null;
    `)
    this.addSql(`
      alter table "taxi_fleet_financial_entries"
        add column if not exists "vat_rate_percent" numeric(5,2) not null default 23;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table "taxi_fleet_trips" drop column if exists "platform";
    `)
    this.addSql(`
      alter table "taxi_fleet_financial_entries" drop column if exists "vat_rate_percent";
    `)
  }
}
