import { Migration } from '@mikro-orm/migrations'

export class Migration20260819095000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "taxi_fleet_weekly_settlements"
        add column if not exists "computed_distance_km" numeric(12,2) not null default 0,
        add column if not exists "total_distance_km" numeric(12,2) not null default 0;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table "taxi_fleet_weekly_settlements"
        drop column if exists "computed_distance_km",
        drop column if exists "total_distance_km";
    `)
  }
}
