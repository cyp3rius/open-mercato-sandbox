import { Migration } from '@mikro-orm/migrations'

export class Migration20260411200000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "resources_resources" add column "procurement_process_id" uuid null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "resources_resources" drop column if exists "procurement_process_id";`)
  }
}
