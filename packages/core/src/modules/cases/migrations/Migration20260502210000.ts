import { Migration } from '@mikro-orm/migrations'

export class Migration20260502210000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
create table if not exists "cases_cases" (
  "id" uuid not null default gen_random_uuid(),
  "tenant_id" uuid not null,
  "organization_id" uuid not null,
  "title" text not null,
  "status_value" text not null,
  "status_label" text null,
  "status_color" text null,
  "customer_entity_id" uuid not null,
  "resource_id" uuid null,
  "procurement_process_id" uuid null,
  "owner_user_id" uuid null,
  "opened_at" timestamptz(6) not null,
  "closed_at" timestamptz(6) null,
  "priority" text not null default 'normal',
  "metadata" jsonb null,
  "created_at" timestamptz(6) not null,
  "updated_at" timestamptz(6) not null,
  "deleted_at" timestamptz(6) null,
  constraint "cases_cases_pkey" primary key ("id")
);
`)
    this.addSql(`create index if not exists "cases_cases_scope_idx" on "cases_cases" ("tenant_id", "organization_id");`)
    this.addSql(`create index if not exists "cases_cases_customer_idx" on "cases_cases" ("customer_entity_id");`)
    this.addSql(`create index if not exists "cases_cases_owner_idx" on "cases_cases" ("owner_user_id");`)
    this.addSql(`create index if not exists "cases_cases_status_idx" on "cases_cases" ("status_value");`)

    this.addSql(`
create table if not exists "cases_timeline_events" (
  "id" uuid not null default gen_random_uuid(),
  "tenant_id" uuid not null,
  "organization_id" uuid not null,
  "case_id" uuid not null,
  "event_type" text not null,
  "body" text not null,
  "occurred_at" timestamptz(6) not null,
  "actor_user_id" uuid null,
  "source_ref" jsonb null,
  "created_at" timestamptz(6) not null,
  "updated_at" timestamptz(6) not null,
  "deleted_at" timestamptz(6) null,
  constraint "cases_timeline_events_pkey" primary key ("id")
);
`)
    this.addSql(`
DO $migration$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cases_timeline_events_case_id_foreign'
  ) THEN
    ALTER TABLE "cases_timeline_events"
    ADD CONSTRAINT "cases_timeline_events_case_id_foreign"
    FOREIGN KEY ("case_id") REFERENCES "cases_cases" ("id")
    ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $migration$;
`)
    this.addSql(`create index if not exists "cases_timeline_case_idx" on "cases_timeline_events" ("case_id");`)
    this.addSql(`create index if not exists "cases_timeline_occurred_idx" on "cases_timeline_events" ("occurred_at");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "cases_timeline_events" cascade;`)
    this.addSql(`drop table if exists "cases_cases" cascade;`)
  }
}
