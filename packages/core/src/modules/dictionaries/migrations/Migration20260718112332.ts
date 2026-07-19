import { Migration } from '@mikro-orm/migrations';

export class Migration20260718112332 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "dictionary_entries" add column "metadata" jsonb null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "dictionary_entries" drop column "metadata";`);
  }

}
