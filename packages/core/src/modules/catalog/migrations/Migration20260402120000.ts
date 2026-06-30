import { Migration } from '@mikro-orm/migrations'

export class Migration20260402120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "catalog_product_service_line_extensions" (
        "id" uuid not null default gen_random_uuid(),
        "organization_id" uuid not null,
        "tenant_id" uuid not null,
        "product_id" uuid not null,
        "service_line_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        constraint "catalog_product_service_line_extensions_pkey" primary key ("id")
      );
    `)
    this.addSql(
      `create index if not exists "catalog_pdt_svc_line_ext_scope_idx" on "catalog_product_service_line_extensions" ("organization_id", "tenant_id");`,
    )
    this.addSql(
      `create unique index if not exists "catalog_pdt_svc_line_ext_product_unique" on "catalog_product_service_line_extensions" ("product_id");`,
    )
    this.addSql(`
      do $$
      begin
        if not exists (
          select 1 from pg_constraint where conname = 'catalog_pdt_svc_line_ext_product_fk'
        ) then
          alter table "catalog_product_service_line_extensions"
            add constraint "catalog_pdt_svc_line_ext_product_fk"
            foreign key ("product_id") references "catalog_products" ("id")
            on update cascade on delete cascade;
        end if;
        if not exists (
          select 1 from pg_constraint where conname = 'catalog_pdt_svc_line_ext_line_fk'
        ) then
          alter table "catalog_product_service_line_extensions"
            add constraint "catalog_pdt_svc_line_ext_line_fk"
            foreign key ("service_line_id") references "catalog_service_lines" ("id")
            on update cascade on delete restrict;
        end if;
      end $$;
    `)
    this.addSql(`
      insert into "catalog_product_service_line_extensions" (
        "id", "organization_id", "tenant_id", "product_id", "service_line_id", "created_at", "updated_at"
      )
      select
        gen_random_uuid(),
        p."organization_id",
        p."tenant_id",
        p."id",
        p."service_line_id",
        now(),
        now()
      from "catalog_products" p
      where p."service_line_id" is not null
        and not exists (
          select 1
          from "catalog_product_service_line_extensions" e
          where e."product_id" = p."id"
        );
    `)
    this.addSql(
      `alter table if exists "catalog_products" drop constraint if exists "catalog_products_service_line_id_foreign";`,
    )
    this.addSql(`alter table "catalog_products" drop column if exists "service_line_id";`)
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "catalog_products" add column if not exists "service_line_id" uuid null;`,
    )
    this.addSql(`
      update "catalog_products" p
      set "service_line_id" = e."service_line_id"
      from "catalog_product_service_line_extensions" e
      where e."product_id" = p."id";
    `)
    this.addSql(
      `alter table "catalog_products" add constraint "catalog_products_service_line_id_foreign" foreign key ("service_line_id") references "catalog_service_lines" ("id") on update cascade on delete restrict;`,
    )
    this.addSql(`drop table if exists "catalog_product_service_line_extensions" cascade;`)
  }
}
