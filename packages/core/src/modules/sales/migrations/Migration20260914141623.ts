import { Migration } from '@mikro-orm/migrations';

export class Migration20260914141623 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table "sales_order_lines" add column "case_plan" jsonb null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "sales_order_lines" drop column "case_plan";`);
  }

}
