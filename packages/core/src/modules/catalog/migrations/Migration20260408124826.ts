import { Migration } from '@mikro-orm/migrations'

/**
 * Service line moved from catalog_products to a junction table.
 * Idempotent: safe when the table/constraints already exist (e.g. partial apply or duplicate run).
 */
export class Migration20260408124826 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "catalog_product_service_line_extensions" (
        "id" uuid not null default gen_random_uuid(),
        "organization_id" uuid not null,
        "tenant_id" uuid not null,
        "product_id" uuid not null,
        "service_line_id" uuid not null,
        "attributes" jsonb null,
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
        alter table "catalog_product_service_line_extensions"
          add constraint "catalog_product_service_line_extensions_product_id_foreign"
          foreign key ("product_id") references "catalog_products" ("id") on update cascade on delete cascade;
      exception
        when duplicate_object then null;
      end
      $$;
    `)

    this.addSql(`
      do $$
      begin
        alter table "catalog_product_service_line_extensions"
          add constraint "catalog_product_service_line_extensions_service_line_id_foreign"
          foreign key ("service_line_id") references "catalog_service_lines" ("id") on update cascade on delete restrict;
      exception
        when duplicate_object then null;
      end
      $$;
    `)

    this.addSql(`
      do $$
      begin
        if exists (
          select 1 from pg_constraint
          where conname = 'catalog_products_service_line_id_foreign'
            and conrelid = 'catalog_products'::regclass
        ) then
          alter table if exists "catalog_products" drop constraint if exists "catalog_products_service_line_id_foreign";
        end if;
      end
      $$;
    `)

    this.addSql(`
      do $$
      begin
        if exists (
          select 1 from information_schema.columns
          where table_schema = current_schema()
            and table_name = 'catalog_products'
            and column_name = 'service_line_id'
        ) then
          alter table "catalog_products" drop column "service_line_id";
        end if;
      end
      $$;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      do $$
      begin
        if not exists (
          select 1 from information_schema.columns
          where table_schema = current_schema()
            and table_name = 'catalog_products'
            and column_name = 'service_line_id'
        ) then
          alter table "catalog_products" add column "service_line_id" uuid null;
        end if;
      end
      $$;
    `)

    this.addSql(`
      do $$
      begin
        if not exists (
          select 1 from pg_constraint
          where conname = 'catalog_products_service_line_id_foreign'
            and conrelid = 'catalog_products'::regclass
        ) then
          alter table "catalog_products"
            add constraint "catalog_products_service_line_id_foreign"
            foreign key ("service_line_id") references "catalog_service_lines" ("id") on update cascade on delete restrict;
        end if;
      end
      $$;
    `)
  }
}
