import { Migration } from '@mikro-orm/migrations'

export class Migration20260411120100 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "resources_resources" add column "status_value" text null;`)
    this.addSql(`alter table "resources_resources" add column "status_label" text null;`)
    this.addSql(`alter table "resources_resources" add column "status_color" text null;`)
    this.addSql(`alter table "resources_resources" add column "status_icon" text null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "resources_resources" drop column if exists "status_value";`)
    this.addSql(`alter table "resources_resources" drop column if exists "status_label";`)
    this.addSql(`alter table "resources_resources" drop column if exists "status_color";`)
    this.addSql(`alter table "resources_resources" drop column if exists "status_icon";`)
  }
}
