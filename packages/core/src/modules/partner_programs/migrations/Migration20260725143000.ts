import { Migration } from '@mikro-orm/migrations'

export class Migration20260725143000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "partner_programs" add column if not exists "incentive_base" text not null default 'net';`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "partner_programs" drop column if exists "incentive_base";`)
  }
}
