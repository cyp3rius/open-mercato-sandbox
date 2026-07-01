import { Migration } from '@mikro-orm/migrations';

export class Migration20260701084846 extends Migration {

  override async up(): Promise<void> {
    // No-op: customer_deals inject columns and unique index are created by
    // customers/Migration20260615103000_customer_deal_referring_partner.ts.
    // This migration file was generated accidentally with the same timestamp as
    // notifications/playbooks snapshots during `yarn db:generate`.
  }

  override async down(): Promise<void> {
    // Intentionally empty — see customers/Migration20260615103000_customer_deal_referring_partner.ts
  }

}
