import { Migration } from '@mikro-orm/migrations'

export class Migration20260504210000_playbook_slug_version_unique extends Migration {
  override async up(): Promise<void> {
    this.addSql(`drop index if exists "playbooks_slug_scope_uidx";`)
    this.addSql(
      `create unique index if not exists "playbooks_slug_version_scope_uidx" on "playbooks_playbooks" ("organization_id", "slug", "version") where "deleted_at" is null;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "playbooks_slug_version_scope_uidx";`)
    this.addSql(
      `create unique index if not exists "playbooks_slug_scope_uidx" on "playbooks_playbooks" ("organization_id", "slug") where "deleted_at" is null;`,
    )
  }
}
