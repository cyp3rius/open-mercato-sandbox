import { Migration } from '@mikro-orm/migrations'

/** Procurement process reference on customer task interactions (procurement work-item sync). */
export class Migration20260427150100 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "customer_interactions" add column "procurement_process_id" uuid null;`,
    )
    this.addSql(
      `alter table "customer_interactions" add column "procurement_process_task_id" uuid null;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table "customer_interactions" drop column if exists "procurement_process_task_id";`,
    )
    this.addSql(
      `alter table "customer_interactions" drop column if exists "procurement_process_id";`,
    )
  }
}
