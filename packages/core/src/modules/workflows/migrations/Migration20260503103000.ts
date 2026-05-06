import { Migration } from '@mikro-orm/migrations'

/** Case playbook procedure tasks mirrored as workflow user tasks (`service_case_id` / title). */
export class Migration20260503103000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "user_tasks" add column "service_case_id" uuid null;`)
    this.addSql(`alter table "user_tasks" add column "service_case_title" varchar(500) null;`)
    this.addSql(`create index "user_tasks_service_case_idx" on "user_tasks" ("service_case_id");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "user_tasks_service_case_idx";`)
    this.addSql(`alter table "user_tasks" drop column if exists "service_case_title";`)
    this.addSql(`alter table "user_tasks" drop column if exists "service_case_id";`)
  }
}
