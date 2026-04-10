import { Migration } from '@mikro-orm/migrations';

export class Migration20260410145836 extends Migration {

  override async up(): Promise<void> {

    this.addSql(`alter table "feature_toggle_overrides" add constraint "feature_toggle_overrides_toggle_id_foreign" foreign key ("toggle_id") references "feature_toggles" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {}
}
