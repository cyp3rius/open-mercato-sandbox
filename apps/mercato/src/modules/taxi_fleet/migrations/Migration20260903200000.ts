import { Migration } from '@mikro-orm/migrations'

export class Migration20260903200000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "taxi_fleet_daily_assignments"
      add column if not exists "planned_shift_start" timestamptz null,
      add column if not exists "planned_shift_end" timestamptz null,
      add column if not exists "gps_distance_km" numeric(12,2) null;
    `)

    this.addSql(`
      update "taxi_fleet_daily_assignments"
      set
        "planned_shift_start" = coalesce("planned_shift_start", "shift_start"),
        "planned_shift_end" = coalesce("planned_shift_end", "shift_end")
      where "deleted_at" is null;
    `)

    this.addSql(`
      update "taxi_fleet_daily_assignments"
      set
        "shift_start" = null,
        "shift_end" = null
      where "status" = 'planned'
        and "deleted_at" is null;
    `)

    this.addSql(`
      alter table "taxi_fleet_weekly_settlements"
      add column if not exists "empty_distance_km" numeric(12,2) not null default 0;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table "taxi_fleet_weekly_settlements"
      drop column if exists "empty_distance_km";
    `)

    this.addSql(`
      alter table "taxi_fleet_daily_assignments"
      drop column if exists "gps_distance_km",
      drop column if exists "planned_shift_end",
      drop column if exists "planned_shift_start";
    `)
  }
}
