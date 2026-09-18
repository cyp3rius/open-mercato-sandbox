import { Migration } from '@mikro-orm/migrations'

export class Migration20260918091932 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "taxi_fleet_discount_codes" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "code" text not null, "label" text null, "discount_type" text not null default 'percent', "value" numeric(18,4) not null, "usage_limit" numeric(18,4) null, "used_amount" numeric(18,4) not null default 0, "active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, "deleted_at" timestamptz null, constraint "taxi_fleet_discount_codes_pkey" primary key ("id"));`,
    )
    this.addSql(
      `create index if not exists "taxi_fleet_discount_codes_scope_idx" on "taxi_fleet_discount_codes" ("tenant_id", "organization_id");`,
    )
    this.addSql(
      `do $$ begin
        alter table "taxi_fleet_discount_codes"
          add constraint "taxi_fleet_discount_codes_tenant_id_organization_id_code_unique"
          unique ("tenant_id", "organization_id", "code");
      exception when duplicate_object then null;
      end $$;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "taxi_fleet_discount_codes" cascade;`)
  }
}
