import { Migration } from '@mikro-orm/migrations'

export class Migration20260808065130 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "taxi_fleet_location_pings" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "team_member_id" uuid not null,
        "assignment_id" uuid null,
        "trip_id" uuid null,
        "recorded_at" timestamptz not null,
        "lat" real not null,
        "lon" real not null,
        "accuracy_m" real null,
        "speed_mps" real null,
        "heading" real null,
        "source" text not null default 'browser',
        "created_at" timestamptz not null,
        constraint "taxi_fleet_location_pings_pkey" primary key ("id")
      );
    `)
    this.addSql(
      `create index if not exists "taxi_fleet_location_pings_scope_idx" on "taxi_fleet_location_pings" ("tenant_id", "organization_id");`,
    )
    this.addSql(
      `create index if not exists "taxi_fleet_location_pings_assignment_recorded_idx" on "taxi_fleet_location_pings" ("assignment_id", "recorded_at");`,
    )
    this.addSql(
      `create index if not exists "taxi_fleet_location_pings_member_recorded_idx" on "taxi_fleet_location_pings" ("team_member_id", "recorded_at");`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "taxi_fleet_location_pings" cascade;`)
  }
}
