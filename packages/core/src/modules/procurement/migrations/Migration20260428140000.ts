import { Migration } from '@mikro-orm/migrations'

/**
 * Idempotent repair: adds refinancing_line_item_id if the table was out of sync
 * (e.g. Migration20260421120000 recorded as applied but column missing, or DB restore).
 */
export class Migration20260428140000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "procurement_processes" add column if not exists "refinancing_line_item_id" uuid null;`,
    )
    this.addSql(`
DO $migration$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'procurement_processes_refinancing_line_item_id_foreign'
  ) THEN
    ALTER TABLE "procurement_processes"
    ADD CONSTRAINT "procurement_processes_refinancing_line_item_id_foreign"
    FOREIGN KEY ("refinancing_line_item_id") REFERENCES "procurement_process_line_items" ("id")
    ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $migration$;`)
  }

  override async down(): Promise<void> {
    this.addSql('select 1')
  }
}
