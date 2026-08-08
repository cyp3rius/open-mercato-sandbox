import { Migration } from '@mikro-orm/migrations'

export class Migration20260713143000 extends Migration {
  override up(): void {
    this.addSql(`alter table "taxi_fleet_trips" alter column "team_member_id" drop not null;`)
    this.addSql(`alter table "taxi_fleet_trips" alter column "resource_id" drop not null;`)
  }

  override down(): void {
    this.addSql(`alter table "taxi_fleet_trips" alter column "team_member_id" set not null;`)
    this.addSql(`alter table "taxi_fleet_trips" alter column "resource_id" set not null;`)
  }
}
