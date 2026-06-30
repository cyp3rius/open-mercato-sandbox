import { Migration } from '@mikro-orm/migrations';

export class Migration20260410145838 extends Migration {

  override async up(): Promise<void> {

    this.addSql(`drop index if exists "entity_translations_scope_uq";`);

    this.addSql(`alter table "entity_translations" alter column "translations" drop default;`);
    this.addSql(`alter table "entity_translations" alter column "translations" type jsonb using ("translations"::jsonb);`);
    this.addSql(`alter table "entity_translations" alter column "created_at" drop default;`);
    this.addSql(`alter table "entity_translations" alter column "created_at" type timestamptz using ("created_at"::timestamptz);`);
    this.addSql(`alter table "entity_translations" alter column "updated_at" drop default;`);
    this.addSql(`alter table "entity_translations" alter column "updated_at" type timestamptz using ("updated_at"::timestamptz);`);
  }

  override async down(): Promise<void> {}
}
