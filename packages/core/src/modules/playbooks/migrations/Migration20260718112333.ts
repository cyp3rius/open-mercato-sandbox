import { Migration } from '@mikro-orm/migrations';

export class Migration20260718112333 extends Migration {

  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "playbooks_playbooks" add column if not exists "recommended_owner_user_ids" jsonb not null default '[]'::jsonb;`,
    );
    this.addSql(
      `alter table if exists "playbooks_playbooks" add column if not exists "default_sla_duration" jsonb null;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "playbooks_playbooks" drop column "recommended_owner_user_ids", drop column "default_sla_duration";`);
  }

}
