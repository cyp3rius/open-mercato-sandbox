import { Migration } from '@mikro-orm/migrations'

export class Migration20260819120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "taxi_fleet_weekly_settlements"
        add column if not exists "revenue_gross" numeric(14,2) not null default 0,
        add column if not exists "revenue_net" numeric(14,2) not null default 0,
        add column if not exists "costs_gross" numeric(14,2) not null default 0,
        add column if not exists "costs_net" numeric(14,2) not null default 0,
        add column if not exists "cash_expected" numeric(14,2) not null default 0,
        add column if not exists "cash_collected" numeric(14,2) not null default 0,
        add column if not exists "bonus_amount" numeric(14,2) not null default 0,
        add column if not exists "compensation_amount" numeric(14,2) not null default 0,
        add column if not exists "airport_a4_amount" numeric(14,2) not null default 0,
        add column if not exists "transfer_amount" numeric(14,2) not null default 0;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table "taxi_fleet_weekly_settlements"
        drop column if exists "revenue_gross",
        drop column if exists "revenue_net",
        drop column if exists "costs_gross",
        drop column if exists "costs_net",
        drop column if exists "cash_expected",
        drop column if exists "cash_collected",
        drop column if exists "bonus_amount",
        drop column if exists "compensation_amount",
        drop column if exists "airport_a4_amount",
        drop column if exists "transfer_amount";
    `)
  }
}
