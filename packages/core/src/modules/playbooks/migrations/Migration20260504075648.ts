import { Migration } from '@mikro-orm/migrations';

export class Migration20260504075648 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "playbooks_playbooks" add column "procedure_definition" jsonb null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "playbooks_playbooks" drop column "procedure_definition";`);
  }

}
