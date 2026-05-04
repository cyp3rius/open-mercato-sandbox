import { Migration } from '@mikro-orm/migrations'

export class Migration20260502230000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
create table if not exists "playbooks_playbooks" (
  "id" uuid not null default gen_random_uuid(),
  "tenant_id" uuid not null,
  "organization_id" uuid not null,
  "slug" text not null,
  "title" text not null,
  "body" text not null,
  "context_tags" jsonb not null default '[]',
  "audience" text not null default 'internal',
  "version" int not null default 1,
  "published_at" timestamptz(6) null,
  "is_active" boolean not null default true,
  "created_at" timestamptz(6) not null,
  "updated_at" timestamptz(6) not null,
  "deleted_at" timestamptz(6) null,
  constraint "playbooks_playbooks_pkey" primary key ("id")
);
`)
    this.addSql(`create index if not exists "playbooks_scope_idx" on "playbooks_playbooks" ("tenant_id", "organization_id");`)
    this.addSql(
      `create unique index if not exists "playbooks_slug_scope_uidx" on "playbooks_playbooks" ("organization_id", "slug") where "deleted_at" is null;`,
    )
    this.addSql(`
create table if not exists "playbooks_bindings" (
  "id" uuid not null default gen_random_uuid(),
  "tenant_id" uuid not null,
  "organization_id" uuid not null,
  "playbook_id" uuid not null,
  "case_id" uuid null,
  "resource_type_slug" text null,
  "created_at" timestamptz(6) not null,
  constraint "playbooks_bindings_pkey" primary key ("id")
);
`)
    this.addSql(`create index if not exists "playbooks_bindings_case_idx" on "playbooks_bindings" ("case_id");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "playbooks_bindings" cascade;`)
    this.addSql(`drop table if exists "playbooks_playbooks" cascade;`)
  }
}
