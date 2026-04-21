import { Migration } from '@mikro-orm/migrations'

/**
 * M:N supplier ↔ specification line items (multiple suppliers can share the same lines).
 * Migrates existing procurement_process_line_items.supplier_id into the junction table, then drops the column.
 */
export class Migration20260424120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "procurement_process_supplier_line_items" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "supplier_id" uuid not null, "line_item_id" uuid not null, "created_at" timestamptz not null, constraint "procurement_process_supplier_line_items_pkey" primary key ("id"));`,
    )
    this.addSql(
      `create unique index "procurement_proc_supplier_line_uidx" on "procurement_process_supplier_line_items" ("supplier_id", "line_item_id");`,
    )
    this.addSql(
      `create index "procurement_supplier_line_supplier_idx" on "procurement_process_supplier_line_items" ("supplier_id");`,
    )
    this.addSql(
      `create index "procurement_supplier_line_line_idx" on "procurement_process_supplier_line_items" ("line_item_id");`,
    )
    this.addSql(
      `alter table "procurement_process_supplier_line_items" add constraint "procurement_supplier_line_supplier_fk" foreign key ("supplier_id") references "procurement_process_suppliers" ("id") on update cascade on delete cascade;`,
    )
    this.addSql(
      `alter table "procurement_process_supplier_line_items" add constraint "procurement_supplier_line_line_fk" foreign key ("line_item_id") references "procurement_process_line_items" ("id") on update cascade on delete cascade;`,
    )
    this.addSql(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'procurement_process_line_items' AND column_name = 'supplier_id'
        ) THEN
          INSERT INTO "procurement_process_supplier_line_items" ("id", "tenant_id", "organization_id", "supplier_id", "line_item_id", "created_at")
          SELECT gen_random_uuid(), "tenant_id", "organization_id", "supplier_id", "id", now()
          FROM "procurement_process_line_items"
          WHERE "supplier_id" IS NOT NULL AND "deleted_at" IS NULL;
        END IF;
      END $$;
    `)
    this.addSql(
      `alter table "procurement_process_line_items" drop constraint if exists "procurement_process_line_items_supplier_id_foreign";`,
    )
    this.addSql(`drop index if exists "procurement_process_line_items_supplier_idx";`)
    this.addSql(`alter table "procurement_process_line_items" drop column if exists "supplier_id";`)
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "procurement_process_line_items" add column "supplier_id" uuid null;`,
    )
    this.addSql(
      `create index "procurement_process_line_items_supplier_idx" on "procurement_process_line_items" ("supplier_id");`,
    )
    this.addSql(
      `alter table "procurement_process_line_items" add constraint "procurement_process_line_items_supplier_id_foreign" foreign key ("supplier_id") references "procurement_process_suppliers" ("id") on update cascade on delete set null;`,
    )
    this.addSql(
      `update "procurement_process_line_items" li
       set "supplier_id" = sub."supplier_id"
       from (
         select distinct on ("line_item_id") "line_item_id", "supplier_id"
         from "procurement_process_supplier_line_items"
         order by "line_item_id", "created_at" asc
       ) sub
       where li."id" = sub."line_item_id" and li."deleted_at" is null;`,
    )
    this.addSql(`drop table if exists "procurement_process_supplier_line_items" cascade;`)
  }
}
