import { Migration } from '@mikro-orm/migrations';

export class Migration20260410145837 extends Migration {

  override async up(): Promise<void> {

    this.addSql(`alter table "indexer_status_logs" alter column "occurred_at" drop default;`);
    this.addSql(`alter table "indexer_status_logs" alter column "occurred_at" type timestamptz using ("occurred_at"::timestamptz);`);
  }

  override async down(): Promise<void> {}
}
