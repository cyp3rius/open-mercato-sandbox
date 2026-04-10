import { Migration } from '@mikro-orm/migrations';

export class Migration20260410145835 extends Migration {

  override async up(): Promise<void> {

    this.addSql(`alter index "cf_defs_active_entity_key_scope_idx" rename to "cf_defs_entity_key_scope_idx";`);
    this.addSql(`alter index "cf_defs_active_entity_global_idx" rename to "cf_defs_entity_global_idx";`);
    this.addSql(`alter index "cf_defs_active_entity_org_idx" rename to "cf_defs_entity_org_idx";`);
    this.addSql(`alter index "cf_defs_active_entity_tenant_idx" rename to "cf_defs_entity_tenant_idx";`);
    this.addSql(`alter index "cf_defs_active_entity_tenant_org_idx" rename to "cf_defs_entity_tenant_org_idx";`);
  }

  override async down(): Promise<void> {}
}
