import { Migration } from '@mikro-orm/migrations'

export class Migration20260410130000_insurance_policies_referring_partner_nullable extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "insurance_policies" alter column "referring_partner_entity_id" drop not null;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "insurance_policies" alter column "referring_partner_entity_id" set not null;`,
    )
  }
}
