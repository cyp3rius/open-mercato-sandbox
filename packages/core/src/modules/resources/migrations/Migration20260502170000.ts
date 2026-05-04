import { Migration } from '@mikro-orm/migrations'

export class Migration20260502170000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "resources_resource_types" add column if not exists "vehicle_financing_eligible" boolean not null default false;`,
    )
    this.addSql(
      `update "resources_resource_types" set "vehicle_financing_eligible" = true where lower(trim("name")) = lower(trim('Company car')) and "deleted_at" is null;`,
    )

    this.addSql(
      `alter table "resources_resources" add column if not exists "insurance_policy_id" uuid null;`,
    )

    this.addSql(`
      create table if not exists "resources_resource_financing_profiles" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "resource_id" uuid not null,
        "financing_kind" text not null,
        "term_months" int null,
        "vehicle_value_amount" double precision null,
        "installment_amount" double precision null,
        "currency_code" text null,
        "valid_from" timestamptz null,
        "valid_to" timestamptz null,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "resources_resource_financing_profiles_pkey" primary key ("id")
      );
    `)
    this.addSql(
      `create index if not exists "resources_resource_financing_profiles_scope_idx" on "resources_resource_financing_profiles" ("tenant_id", "organization_id");`,
    )
    this.addSql(
      `create index if not exists "resources_resource_financing_profiles_resource_idx" on "resources_resource_financing_profiles" ("resource_id");`,
    )
    this.addSql(`
      alter table "resources_resource_financing_profiles"
      add constraint "resources_resource_financing_profiles_resource_id_foreign"
      foreign key ("resource_id") references "resources_resources" ("id") on update cascade on delete cascade;
    `)

    this.addSql(`
      create table if not exists "resources_resource_gallery_items" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "resource_id" uuid not null,
        "attachment_id" uuid not null,
        "sort_order" int not null default 0,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "resources_resource_gallery_items_pkey" primary key ("id")
      );
    `)
    this.addSql(
      `create index if not exists "resources_resource_gallery_items_scope_idx" on "resources_resource_gallery_items" ("tenant_id", "organization_id");`,
    )
    this.addSql(
      `create index if not exists "resources_resource_gallery_items_resource_idx" on "resources_resource_gallery_items" ("resource_id");`,
    )
    this.addSql(`
      alter table "resources_resource_gallery_items"
      add constraint "resources_resource_gallery_items_resource_id_foreign"
      foreign key ("resource_id") references "resources_resources" ("id") on update cascade on delete cascade;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "resources_resource_gallery_items" cascade;`)
    this.addSql(`drop table if exists "resources_resource_financing_profiles" cascade;`)
    this.addSql(`alter table "resources_resources" drop column if exists "insurance_policy_id";`)
    this.addSql(`alter table "resources_resource_types" drop column if exists "vehicle_financing_eligible";`)
  }
}
