import { Migration } from '@mikro-orm/migrations';

export class Migration20260725131035 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "sales_quotes" add column if not exists "referring_partner_entity_id" uuid null;`);
    this.addSql(`alter table "sales_orders" add column if not exists "referring_partner_entity_id" uuid null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "sales_orders" drop column if exists "referring_partner_entity_id";`);
    this.addSql(`alter table "sales_quotes" drop column if exists "referring_partner_entity_id";`);
  }

}
