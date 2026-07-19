import { Migration } from '@mikro-orm/migrations'

export class Migration20260718112332 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "cases_cases" add column "due_at" timestamptz null, add column "overdue_notified_at" timestamptz null, add column "recurrence_enabled" boolean not null default false, add column "recurrence_series_id" uuid null, add column "recurrence_interval_amount" int null, add column "recurrence_interval_unit" text null, add column "recurrence_create_lead_time" jsonb null, add column "recurrence_occurrence_key" text null, add column "recurrence_next_occurrence_at" timestamptz null;`,
    )
    this.addSql(`create index "cases_cases_recurrence_series_idx" on "cases_cases" ("recurrence_series_id");`)
    this.addSql(`create index "cases_cases_due_idx" on "cases_cases" ("due_at");`)
    this.addSql(
      `create unique index "cases_cases_recurrence_occurrence_unique" on "cases_cases" ("recurrence_series_id", "recurrence_occurrence_key");`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "cases_cases_recurrence_occurrence_unique";`)
    this.addSql(`drop index if exists "cases_cases_due_idx";`)
    this.addSql(`drop index if exists "cases_cases_recurrence_series_idx";`)
    this.addSql(
      `alter table "cases_cases" drop column if exists "due_at", drop column if exists "overdue_notified_at", drop column if exists "recurrence_enabled", drop column if exists "recurrence_series_id", drop column if exists "recurrence_interval_amount", drop column if exists "recurrence_interval_unit", drop column if exists "recurrence_create_lead_time", drop column if exists "recurrence_occurrence_key", drop column if exists "recurrence_next_occurrence_at";`,
    )
  }
}
