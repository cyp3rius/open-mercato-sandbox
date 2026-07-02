import { Migration } from '@mikro-orm/migrations';

export class Migration20260702065021 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "users" add column "preferred_locale" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "users" drop column "preferred_locale";`);
  }

}
