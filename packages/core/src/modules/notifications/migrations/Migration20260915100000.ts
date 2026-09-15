import { Migration } from '@mikro-orm/migrations'

export class Migration20260915100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "user_notification_preferences"
        add column if not exists "push_enabled" boolean null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table "user_notification_preferences"
        drop column if exists "push_enabled";
    `)
  }
}
