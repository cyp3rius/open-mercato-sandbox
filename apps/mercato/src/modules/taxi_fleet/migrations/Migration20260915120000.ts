import { Migration } from '@mikro-orm/migrations'

export class Migration20260915120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "taxi_fleet_driver_communications" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "kind" text not null,
        "title" text not null,
        "body" text not null,
        "status" text not null default 'draft',
        "scheduled_at" timestamptz null,
        "sent_at" timestamptz null,
        "created_by_user_id" uuid not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "taxi_fleet_driver_communications_pkey" primary key ("id")
      );
    `)
    this.addSql(`
      create index if not exists "taxi_fleet_driver_comms_scope_idx"
        on "taxi_fleet_driver_communications" ("tenant_id", "organization_id");
    `)
    this.addSql(`
      create index if not exists "taxi_fleet_driver_comms_status_idx"
        on "taxi_fleet_driver_communications" ("status", "scheduled_at");
    `)
    this.addSql(`
      create table if not exists "taxi_fleet_driver_communication_recipients" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "communication_id" uuid not null,
        "team_member_id" uuid not null,
        "user_id" uuid not null,
        "delivery_status" text not null default 'pending',
        "read_at" timestamptz null,
        "last_error" text null,
        "attempt_count" int not null default 0,
        "last_attempt_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "taxi_fleet_driver_communication_recipients_pkey" primary key ("id")
      );
    `)
    this.addSql(`
      create unique index if not exists "taxi_fleet_driver_comm_recipients_uidx"
        on "taxi_fleet_driver_communication_recipients" ("communication_id", "team_member_id");
    `)
    this.addSql(`
      create index if not exists "taxi_fleet_driver_comm_recipients_comm_idx"
        on "taxi_fleet_driver_communication_recipients" ("communication_id");
    `)
    this.addSql(`
      create index if not exists "taxi_fleet_driver_comm_recipients_member_idx"
        on "taxi_fleet_driver_communication_recipients" ("team_member_id", "tenant_id");
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "taxi_fleet_driver_communication_recipients";`)
    this.addSql(`drop table if exists "taxi_fleet_driver_communications";`)
  }
}
