import { Migration } from '@mikro-orm/migrations'

export class Migration20260410120000_insurance_insurer_status extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "insurance_insurers" add column "status" text not null default 'active';`,
    )
    this.addSql(
      `update "insurance_insurers" set "status" = case when "is_active" then 'active' else 'inactive' end;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "insurance_insurers" drop column "status";`)
  }
}
