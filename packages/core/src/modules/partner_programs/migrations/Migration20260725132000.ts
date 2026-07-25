import { Migration } from '@mikro-orm/migrations'

export class Migration20260725132000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "partner_programs" add column if not exists "incentive_percent" numeric(7,4) not null default 0;`,
    )

    this.addSql(`
create table if not exists "partner_programs_incentive_ledger" (
  "id" uuid not null default gen_random_uuid(),
  "tenant_id" uuid not null,
  "organization_id" uuid not null,
  "customer_entity_id" uuid not null,
  "program_id" uuid null,
  "kind" text not null,
  "amount" numeric(18,4) not null,
  "currency_code" text not null,
  "sales_order_id" uuid null,
  "rate_percent" numeric(7,4) null,
  "base_amount" numeric(18,4) null,
  "note" text null,
  "created_by_user_id" uuid null,
  "created_at" timestamptz(6) not null,
  "updated_at" timestamptz(6) not null,
  "deleted_at" timestamptz(6) null,
  constraint "partner_programs_incentive_ledger_pkey" primary key ("id")
);
`)

    this.addSql(`
create index if not exists "partner_programs_incentive_ledger_customer_scope_idx"
on "partner_programs_incentive_ledger" ("customer_entity_id", "organization_id", "tenant_id");
`)
    this.addSql(`
create index if not exists "partner_programs_incentive_ledger_order_idx"
on "partner_programs_incentive_ledger" ("sales_order_id");
`)
    this.addSql(`
create unique index if not exists "partner_programs_incentive_ledger_order_accrual_uidx"
on "partner_programs_incentive_ledger" ("sales_order_id")
where "kind" = 'accrual' and "deleted_at" is null and "sales_order_id" is not null;
`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "partner_programs_incentive_ledger_order_accrual_uidx";`)
    this.addSql(`drop index if exists "partner_programs_incentive_ledger_order_idx";`)
    this.addSql(`drop index if exists "partner_programs_incentive_ledger_customer_scope_idx";`)
    this.addSql(`drop table if exists "partner_programs_incentive_ledger";`)
    this.addSql(`alter table "partner_programs" drop column if exists "incentive_percent";`)
  }
}
