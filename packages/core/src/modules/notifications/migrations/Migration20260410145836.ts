import { Migration } from '@mikro-orm/migrations';

export class Migration20260410145836 extends Migration {

  override async up(): Promise<void> {

    this.addSql(`alter table "notifications" alter column "created_at" drop default;`);
    this.addSql(`alter table "notifications" alter column "created_at" type timestamptz using ("created_at"::timestamptz);`);
    this.addSql(`comment on column "notifications"."title_key" is null;`);
    this.addSql(`comment on column "notifications"."body_key" is null;`);
    this.addSql(`comment on column "notifications"."title_variables" is null;`);
    this.addSql(`comment on column "notifications"."body_variables" is null;`);
  }

  override async down(): Promise<void> {}
}
