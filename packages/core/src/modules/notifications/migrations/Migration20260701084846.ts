import { Migration } from '@mikro-orm/migrations';

export class Migration20260701084846 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "user_notification_preferences" ("id" uuid not null default gen_random_uuid(), "user_id" uuid not null, "tenant_id" uuid not null, "notification_type" text not null, "enabled" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz null, constraint "user_notification_preferences_pkey" primary key ("id"));`);
    this.addSql(`alter table "user_notification_preferences" add constraint "user_notification_preferences_user_id_tenant_id_notificat_unique" unique ("user_id", "tenant_id", "notification_type");`);
  }

}
