import { Migration } from '@mikro-orm/migrations'

export class Migration20260829140000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "taxi_fleet_platform_sync_runs"
      add column if not exists "job_payload" jsonb null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table "taxi_fleet_platform_sync_runs"
      drop column if exists "job_payload";
    `)
  }
}
