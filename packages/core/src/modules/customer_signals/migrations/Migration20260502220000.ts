import { Migration } from '@mikro-orm/migrations'

export class Migration20260502220000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
create table if not exists "customer_signals_signals" (
  "id" uuid not null default gen_random_uuid(),
  "tenant_id" uuid not null,
  "organization_id" uuid not null,
  "customer_entity_id" uuid not null,
  "signal_type" text not null,
  "source" text not null,
  "subject_entity_type" text null,
  "subject_entity_id" uuid null,
  "payload" jsonb null,
  "occurred_at" timestamptz(6) not null,
  "created_at" timestamptz(6) not null,
  constraint "customer_signals_signals_pkey" primary key ("id")
);
`)
    this.addSql(
      `create index if not exists "customer_signals_customer_time_idx" on "customer_signals_signals" ("customer_entity_id", "occurred_at");`,
    )
    this.addSql(
      `create index if not exists "customer_signals_type_time_idx" on "customer_signals_signals" ("signal_type", "occurred_at");`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "customer_signals_signals" cascade;`)
  }
}
