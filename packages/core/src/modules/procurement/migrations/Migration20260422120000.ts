import { Migration } from '@mikro-orm/migrations'

export class Migration20260422120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "procurement_organization_settings" add column "terminal_process_status_value" text null;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "procurement_organization_settings" drop column if exists "terminal_process_status_value";`,
    )
  }
}
