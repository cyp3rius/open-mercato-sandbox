import { Migration } from '@mikro-orm/migrations';

export class Migration20260410145838 extends Migration {

  override async up(): Promise<void> {

    this.addSql(`alter index "carrier_shipments_organization_id_tenant_id_unif_b5ab4_index" rename to "carrier_shipments_organization_id_tenant_id_unifie_ffc31_index";`);
    this.addSql(`alter index "carrier_shipments_provider_key_carrier_shipment_i_f9f17_index" rename to "carrier_shipments_provider_key_carrier_shipment_id_96494_index";`);
  }

  override async down(): Promise<void> {}
}
