import { Migration } from '@mikro-orm/migrations'

export class Migration20260826100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "taxi_fleet_trips"
      add column if not exists "external_trip_id" text null;
    `)
    this.addSql(`
      create unique index if not exists "taxi_fleet_trips_platform_external_uidx"
      on "taxi_fleet_trips" ("tenant_id", "organization_id", "platform", "external_trip_id")
      where "external_trip_id" is not null and "deleted_at" is null;
    `)
    this.addSql(`
      create index if not exists "taxi_fleet_trips_platform_started_idx"
      on "taxi_fleet_trips" ("tenant_id", "organization_id", "platform", "started_at");
    `)

    this.addSql(`
      alter table "taxi_fleet_driver_profiles"
      add column if not exists "bolt_driver_id" text null,
      add column if not exists "uber_driver_id" text null,
      add column if not exists "free_driver_id" text null;
    `)
    this.addSql(`
      create unique index if not exists "taxi_fleet_driver_profiles_bolt_id_uidx"
      on "taxi_fleet_driver_profiles" ("tenant_id", "organization_id", "bolt_driver_id")
      where "bolt_driver_id" is not null and "deleted_at" is null;
    `)
    this.addSql(`
      create unique index if not exists "taxi_fleet_driver_profiles_uber_id_uidx"
      on "taxi_fleet_driver_profiles" ("tenant_id", "organization_id", "uber_driver_id")
      where "uber_driver_id" is not null and "deleted_at" is null;
    `)
    this.addSql(`
      create unique index if not exists "taxi_fleet_driver_profiles_free_id_uidx"
      on "taxi_fleet_driver_profiles" ("tenant_id", "organization_id", "free_driver_id")
      where "free_driver_id" is not null and "deleted_at" is null;
    `)

    this.addSql(`
      create table if not exists "taxi_fleet_platform_sync_runs" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "platform" text not null,
        "trigger" text not null,
        "status" text not null default 'running',
        "started_at" timestamptz(6) not null,
        "finished_at" timestamptz(6) null,
        "fetched_count" int4 not null default 0,
        "upserted_count" int4 not null default 0,
        "skipped_count" int4 not null default 0,
        "error_count" int4 not null default 0,
        "window_from" timestamptz(6) null,
        "window_to" timestamptz(6) null,
        "error_summary" jsonb null,
        "created_at" timestamptz(6) not null,
        "updated_at" timestamptz(6) not null,
        "deleted_at" timestamptz(6) null,
        constraint "taxi_fleet_platform_sync_runs_pkey" primary key ("id")
      );
    `)
    this.addSql(`
      create index if not exists "taxi_fleet_platform_sync_runs_scope_idx"
      on "taxi_fleet_platform_sync_runs" ("tenant_id", "organization_id", "started_at");
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "taxi_fleet_platform_sync_runs" cascade;`)
    this.addSql(`drop index if exists "taxi_fleet_driver_profiles_free_id_uidx";`)
    this.addSql(`drop index if exists "taxi_fleet_driver_profiles_uber_id_uidx";`)
    this.addSql(`drop index if exists "taxi_fleet_driver_profiles_bolt_id_uidx";`)
    this.addSql(`
      alter table "taxi_fleet_driver_profiles"
      drop column if exists "bolt_driver_id",
      drop column if exists "uber_driver_id",
      drop column if exists "free_driver_id";
    `)
    this.addSql(`drop index if exists "taxi_fleet_trips_platform_started_idx";`)
    this.addSql(`drop index if exists "taxi_fleet_trips_platform_external_uidx";`)
    this.addSql(`alter table "taxi_fleet_trips" drop column if exists "external_trip_id";`)
  }
}
