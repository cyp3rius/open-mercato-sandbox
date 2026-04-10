import { Migration } from '@mikro-orm/migrations'

export class Migration20260410153000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "resources_resource_service_book_entries" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "service_type" text not null, "service_activity" text not null, "service_in_at" timestamptz not null, "service_out_at" timestamptz null, "description" text null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "resource_id" uuid not null, constraint "resources_resource_service_book_entries_pkey" primary key ("id"));`,
    )
    this.addSql(
      `create index "resources_resource_service_book_entries_resource_in_created_idx" on "resources_resource_service_book_entries" ("resource_id", "service_in_at", "created_at");`,
    )
    this.addSql(
      `create index "resources_resource_service_book_entries_tenant_org_idx" on "resources_resource_service_book_entries" ("tenant_id", "organization_id");`,
    )
    this.addSql(
      `create index "resources_resource_service_book_entries_resource_idx" on "resources_resource_service_book_entries" ("resource_id");`,
    )
    this.addSql(
      `alter table "resources_resource_service_book_entries" add constraint "resources_resource_service_book_entries_resource_id_foreign" foreign key ("resource_id") references "resources_resources" ("id") on update cascade;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "resources_resource_service_book_entries" cascade;`)
  }
}
