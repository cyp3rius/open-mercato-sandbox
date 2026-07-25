import { Migration } from '@mikro-orm/migrations';

/**
 * Snapshot-polluted migration (MikroORM included unrelated customer_* FK drops).
 * Kept as a no-op so existing environments can mark it applied safely.
 */
export class Migration20260702065023 extends Migration {

  override async up(): Promise<void> {
    // no-op: original up() only dropped cross-module customer_* foreign keys
  }

  override async down(): Promise<void> {
    // no-op: original down() would recreate unrelated tables
  }

}
