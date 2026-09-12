import { Migration } from '@mikro-orm/migrations'

export class Migration20260909104042 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "taxi_fleet_driver_profiles"
      add column if not exists "default_resource_ids" jsonb null;
    `)
    this.addSql(`
      update "taxi_fleet_driver_profiles"
      set "default_resource_ids" = jsonb_build_array("default_resource_id")
      where "default_resource_id" is not null
        and ("default_resource_ids" is null or "default_resource_ids" = 'null'::jsonb);
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table "taxi_fleet_driver_profiles"
      drop column if exists "default_resource_ids";
    `)
  }
}
