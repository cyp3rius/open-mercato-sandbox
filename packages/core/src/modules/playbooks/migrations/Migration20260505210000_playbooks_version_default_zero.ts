import { Migration } from '@mikro-orm/migrations'

export class Migration20260505210000_playbooks_version_default_zero extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "playbooks_playbooks" alter column "version" set default 0;`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "playbooks_playbooks" alter column "version" set default 1;`)
  }
}
