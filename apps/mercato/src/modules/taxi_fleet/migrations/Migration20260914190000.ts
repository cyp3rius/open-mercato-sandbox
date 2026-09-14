import { Migration } from '@mikro-orm/migrations'

export class Migration20260914190000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "taxi_fleet_trips"
        add column if not exists "driver_reminder_push_sent_at" timestamptz null;
    `)
    this.addSql(`
      create table if not exists "taxi_fleet_push_subscriptions" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "user_id" uuid not null,
        "team_member_id" uuid not null,
        "endpoint" text not null,
        "p256dh" text not null,
        "auth" text not null,
        "user_agent" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "taxi_fleet_push_subscriptions_pkey" primary key ("id")
      );
    `)
    this.addSql(`
      create unique index if not exists "taxi_fleet_push_subscriptions_endpoint_uidx"
        on "taxi_fleet_push_subscriptions" ("endpoint");
    `)
    this.addSql(`
      create index if not exists "taxi_fleet_push_subscriptions_scope_idx"
        on "taxi_fleet_push_subscriptions" ("tenant_id", "organization_id");
    `)
    this.addSql(`
      create index if not exists "taxi_fleet_push_subscriptions_member_idx"
        on "taxi_fleet_push_subscriptions" ("team_member_id", "tenant_id");
    `)
    this.addSql(`
      create index if not exists "taxi_fleet_push_subscriptions_user_idx"
        on "taxi_fleet_push_subscriptions" ("user_id", "tenant_id");
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "taxi_fleet_push_subscriptions";`)
    this.addSql(`
      alter table "taxi_fleet_trips"
        drop column if exists "driver_reminder_push_sent_at";
    `)
  }
}
