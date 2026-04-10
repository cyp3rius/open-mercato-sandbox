import { Migration } from '@mikro-orm/migrations';

export class Migration20260410145835 extends Migration {

  override async up(): Promise<void> {

    this.addSql(`drop index if exists "example_customer_priorities_customer_idx";`);
    this.addSql(`drop index if exists "example_customer_priorities_org_tenant_idx";`);
  }

  override async down(): Promise<void> {}
}
