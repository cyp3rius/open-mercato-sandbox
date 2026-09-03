import { Migration } from '@mikro-orm/migrations'

export class Migration20260903120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "taxi_fleet_driver_profiles"
      add column if not exists "payout_mode" text not null default 'fixed',
      add column if not exists "payout_tiers_json" jsonb null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table "taxi_fleet_driver_profiles"
      drop column if exists "payout_tiers_json",
      drop column if exists "payout_mode";
    `)
  }
}
