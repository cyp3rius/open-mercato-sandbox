import { Migration } from '@mikro-orm/migrations'

export class Migration20260918120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table if exists "taxi_fleet_trips"
        add column if not exists "ordering_person_id" uuid null;
    `)
    this.addSql(`
      create index if not exists "taxi_fleet_trips_ordering_person_idx"
        on "taxi_fleet_trips" ("tenant_id", "organization_id", "ordering_person_id");
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "taxi_fleet_trips_ordering_person_idx";`)
    this.addSql(`
      alter table if exists "taxi_fleet_trips"
        drop column if exists "ordering_person_id";
    `)
  }
}
