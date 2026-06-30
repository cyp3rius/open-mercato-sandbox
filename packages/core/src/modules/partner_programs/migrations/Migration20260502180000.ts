import { Migration } from '@mikro-orm/migrations'

export class Migration20260502180000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
create table if not exists "partner_programs" (
  "id" uuid not null default gen_random_uuid(),
  "tenant_id" uuid not null,
  "organization_id" uuid not null,
  "name" text not null,
  "description" text null,
  "valid_from" timestamptz(6) null,
  "valid_to" timestamptz(6) null,
  "is_active" boolean not null default true,
  "metadata" jsonb null,
  "created_at" timestamptz(6) not null,
  "updated_at" timestamptz(6) not null,
  "deleted_at" timestamptz(6) null,
  constraint "partner_programs_pkey" primary key ("id")
);
`)
    this.addSql(
      `create index if not exists "partner_programs_scope_idx" on "partner_programs" ("tenant_id", "organization_id");`,
    )

    this.addSql(`
create table if not exists "partner_programs_memberships" (
  "id" uuid not null default gen_random_uuid(),
  "tenant_id" uuid not null,
  "organization_id" uuid not null,
  "program_id" uuid not null,
  "customer_entity_id" uuid not null,
  "role" text null,
  "joined_at" timestamptz(6) not null,
  "left_at" timestamptz(6) null,
  "created_at" timestamptz(6) not null,
  "updated_at" timestamptz(6) not null,
  "deleted_at" timestamptz(6) null,
  constraint "partner_programs_memberships_pkey" primary key ("id")
);
`)
    this.addSql(`
DO $migration$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'partner_programs_memberships_program_id_foreign'
  ) THEN
    ALTER TABLE "partner_programs_memberships"
    ADD CONSTRAINT "partner_programs_memberships_program_id_foreign"
    FOREIGN KEY ("program_id") REFERENCES "partner_programs" ("id")
    ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $migration$;
`)
    this.addSql(
      `create index if not exists "partner_programs_memberships_program_idx" on "partner_programs_memberships" ("program_id");`,
    )
    this.addSql(
      `create index if not exists "partner_programs_memberships_customer_idx" on "partner_programs_memberships" ("customer_entity_id");`,
    )
    this.addSql(`
create unique index if not exists "partner_programs_memberships_program_customer_active_uidx"
on "partner_programs_memberships" ("program_id", "customer_entity_id")
where "deleted_at" is null;
`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "partner_programs_memberships_program_customer_active_uidx";`)
    this.addSql(`drop index if exists "partner_programs_memberships_customer_idx";`)
    this.addSql(`drop index if exists "partner_programs_memberships_program_idx";`)
    this.addSql(`
DO $migration$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'partner_programs_memberships_program_id_foreign'
  ) THEN
    alter table if exists "partner_programs_memberships" drop constraint if exists "partner_programs_memberships_program_id_foreign";
  END IF;
END $migration$;
`)
    this.addSql(`drop table if exists "partner_programs_memberships";`)
    this.addSql(`drop index if exists "partner_programs_scope_idx";`)
    this.addSql(`drop table if exists "partner_programs";`)
  }
}
