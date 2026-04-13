import { Migration } from '@mikro-orm/migrations'

export class Migration20260408120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "resources_resources" add column "customer_entity_id" uuid null;`)
    this.addSql(
      `create table "resources_resource_accessory_links" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "is_mounted" boolean not null default false, "created_at" timestamptz not null, "updated_at" timestamptz not null, "host_resource_id" uuid not null, "accessory_resource_id" uuid not null, constraint "resources_resource_accessory_links_pkey" primary key ("id"));`,
    )
    this.addSql(
      `create index "resources_resource_accessory_links_scope_idx" on "resources_resource_accessory_links" ("organization_id", "tenant_id");`,
    )
    this.addSql(
      `create index "resources_resource_accessory_links_host_idx" on "resources_resource_accessory_links" ("host_resource_id");`,
    )
    this.addSql(
      `alter table "resources_resource_accessory_links" add constraint "resources_resource_accessory_links_host_resource_id_foreign" foreign key ("host_resource_id") references "resources_resources" ("id") on update cascade;`,
    )
    this.addSql(
      `alter table "resources_resource_accessory_links" add constraint "resources_resource_accessory_links_accessory_resource_id_foreign" foreign key ("accessory_resource_id") references "resources_resources" ("id") on update cascade;`,
    )
    this.addSql(
      `alter table "resources_resource_accessory_links" add constraint "resources_resource_accessory_links_host_accessory_unique" unique ("host_resource_id", "accessory_resource_id");`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "resources_resource_accessory_links" cascade;`)
    this.addSql(`alter table "resources_resources" drop column if exists "customer_entity_id";`)
  }
}
