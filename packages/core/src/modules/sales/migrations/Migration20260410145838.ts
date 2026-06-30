import { Migration } from '@mikro-orm/migrations';

export class Migration20260410145838 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "sales_quotes" drop constraint if exists "sales_quotes_shipping_method_ref_id_foreign";`);
    this.addSql(`alter table "sales_quotes" add constraint "sales_quotes_shipping_method_ref_id_foreign" foreign key ("shipping_method_ref_id") references "sales_shipping_methods" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table if exists "sales_quotes" drop constraint if exists "sales_quotes_delivery_window_ref_id_foreign";`);
    this.addSql(`alter table "sales_quotes" add constraint "sales_quotes_delivery_window_ref_id_foreign" foreign key ("delivery_window_ref_id") references "sales_delivery_windows" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table if exists "sales_quotes" drop constraint if exists "sales_quotes_payment_method_ref_id_foreign";`);
    this.addSql(`alter table "sales_quotes" add constraint "sales_quotes_payment_method_ref_id_foreign" foreign key ("payment_method_ref_id") references "sales_payment_methods" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table if exists "sales_quotes" drop constraint if exists "sales_quotes_channel_ref_id_foreign";`);
    this.addSql(`alter table "sales_quotes" add constraint "sales_quotes_channel_ref_id_foreign" foreign key ("channel_ref_id") references "sales_channels" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table if exists "sales_quote_lines" drop constraint if exists "sales_quote_lines_quote_id_foreign";`);
    this.addSql(`alter table "sales_quote_lines" add constraint "sales_quote_lines_quote_id_foreign" foreign key ("quote_id") references "sales_quotes" ("id") on update cascade;`);

    this.addSql(`alter table if exists "sales_quote_adjustments" drop constraint if exists "sales_quote_adjustments_quote_id_foreign";`);
    this.addSql(`alter table "sales_quote_adjustments" add constraint "sales_quote_adjustments_quote_id_foreign" foreign key ("quote_id") references "sales_quotes" ("id") on update cascade;`);
    this.addSql(`alter table if exists "sales_quote_adjustments" drop constraint if exists "sales_quote_adjustments_quote_line_id_foreign";`);
    this.addSql(`alter table "sales_quote_adjustments" add constraint "sales_quote_adjustments_quote_line_id_foreign" foreign key ("quote_line_id") references "sales_quote_lines" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table if exists "sales_orders" drop constraint if exists "sales_orders_channel_ref_id_foreign";`);
    this.addSql(`alter table "sales_orders" add constraint "sales_orders_channel_ref_id_foreign" foreign key ("channel_ref_id") references "sales_channels" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table if exists "sales_orders" drop constraint if exists "sales_orders_shipping_method_ref_id_foreign";`);
    this.addSql(`alter table "sales_orders" add constraint "sales_orders_shipping_method_ref_id_foreign" foreign key ("shipping_method_ref_id") references "sales_shipping_methods" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table if exists "sales_orders" drop constraint if exists "sales_orders_delivery_window_ref_id_foreign";`);
    this.addSql(`alter table "sales_orders" add constraint "sales_orders_delivery_window_ref_id_foreign" foreign key ("delivery_window_ref_id") references "sales_delivery_windows" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table if exists "sales_orders" drop constraint if exists "sales_orders_payment_method_ref_id_foreign";`);
    this.addSql(`alter table "sales_orders" add constraint "sales_orders_payment_method_ref_id_foreign" foreign key ("payment_method_ref_id") references "sales_payment_methods" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table if exists "sales_shipments" drop constraint if exists "sales_shipments_order_id_foreign";`);
    this.addSql(`alter table "sales_shipments" add constraint "sales_shipments_order_id_foreign" foreign key ("order_id") references "sales_orders" ("id") on update cascade;`);

    this.addSql(`alter table if exists "sales_payments" drop constraint if exists "sales_payments_order_id_foreign";`);
    this.addSql(`alter table "sales_payments" add constraint "sales_payments_order_id_foreign" foreign key ("order_id") references "sales_orders" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table if exists "sales_payments" drop constraint if exists "sales_payments_payment_method_id_foreign";`);
    this.addSql(`alter table "sales_payments" add constraint "sales_payments_payment_method_id_foreign" foreign key ("payment_method_id") references "sales_payment_methods" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table if exists "sales_order_lines" drop constraint if exists "sales_order_lines_order_id_foreign";`);
    this.addSql(`alter table "sales_order_lines" add constraint "sales_order_lines_order_id_foreign" foreign key ("order_id") references "sales_orders" ("id") on update cascade;`);

    this.addSql(`alter table if exists "sales_shipment_items" drop constraint if exists "sales_shipment_items_shipment_id_foreign";`);
    this.addSql(`alter table "sales_shipment_items" add constraint "sales_shipment_items_shipment_id_foreign" foreign key ("shipment_id") references "sales_shipments" ("id") on update cascade;`);
    this.addSql(`alter table if exists "sales_shipment_items" drop constraint if exists "sales_shipment_items_order_line_id_foreign";`);
    this.addSql(`alter table "sales_shipment_items" add constraint "sales_shipment_items_order_line_id_foreign" foreign key ("order_line_id") references "sales_order_lines" ("id") on update cascade;`);

    this.addSql(`alter table if exists "sales_order_adjustments" drop constraint if exists "sales_order_adjustments_order_id_foreign";`);
    this.addSql(`alter table "sales_order_adjustments" add constraint "sales_order_adjustments_order_id_foreign" foreign key ("order_id") references "sales_orders" ("id") on update cascade;`);
    this.addSql(`alter table if exists "sales_order_adjustments" drop constraint if exists "sales_order_adjustments_order_line_id_foreign";`);
    this.addSql(`alter table "sales_order_adjustments" add constraint "sales_order_adjustments_order_line_id_foreign" foreign key ("order_line_id") references "sales_order_lines" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table if exists "sales_notes" drop constraint if exists "sales_notes_order_id_foreign";`);
    this.addSql(`alter table "sales_notes" add constraint "sales_notes_order_id_foreign" foreign key ("order_id") references "sales_orders" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table if exists "sales_notes" drop constraint if exists "sales_notes_quote_id_foreign";`);
    this.addSql(`alter table "sales_notes" add constraint "sales_notes_quote_id_foreign" foreign key ("quote_id") references "sales_quotes" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table if exists "sales_invoices" drop constraint if exists "sales_invoices_order_id_foreign";`);
    this.addSql(`alter table "sales_invoices" add constraint "sales_invoices_order_id_foreign" foreign key ("order_id") references "sales_orders" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table if exists "sales_payment_allocations" drop constraint if exists "sales_payment_allocations_payment_id_foreign";`);
    this.addSql(`alter table "sales_payment_allocations" add constraint "sales_payment_allocations_payment_id_foreign" foreign key ("payment_id") references "sales_payments" ("id") on update cascade;`);
    this.addSql(`alter table if exists "sales_payment_allocations" drop constraint if exists "sales_payment_allocations_order_id_foreign";`);
    this.addSql(`alter table "sales_payment_allocations" add constraint "sales_payment_allocations_order_id_foreign" foreign key ("order_id") references "sales_orders" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table if exists "sales_payment_allocations" drop constraint if exists "sales_payment_allocations_invoice_id_foreign";`);
    this.addSql(`alter table "sales_payment_allocations" add constraint "sales_payment_allocations_invoice_id_foreign" foreign key ("invoice_id") references "sales_invoices" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table if exists "sales_invoice_lines" drop constraint if exists "sales_invoice_lines_invoice_id_foreign";`);
    this.addSql(`alter table "sales_invoice_lines" add constraint "sales_invoice_lines_invoice_id_foreign" foreign key ("invoice_id") references "sales_invoices" ("id") on update cascade;`);
    this.addSql(`alter table if exists "sales_invoice_lines" drop constraint if exists "sales_invoice_lines_order_line_id_foreign";`);
    this.addSql(`alter table "sales_invoice_lines" add constraint "sales_invoice_lines_order_line_id_foreign" foreign key ("order_line_id") references "sales_order_lines" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table if exists "sales_document_tag_assignments" drop constraint if exists "sales_document_tag_assignments_tag_id_foreign";`);
    this.addSql(`alter table "sales_document_tag_assignments" add constraint "sales_document_tag_assignments_tag_id_foreign" foreign key ("tag_id") references "sales_document_tags" ("id") on update cascade;`);
    this.addSql(`alter table if exists "sales_document_tag_assignments" drop constraint if exists "sales_document_tag_assignments_order_id_foreign";`);
    this.addSql(`alter table "sales_document_tag_assignments" add constraint "sales_document_tag_assignments_order_id_foreign" foreign key ("order_id") references "sales_orders" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table if exists "sales_document_tag_assignments" drop constraint if exists "sales_document_tag_assignments_quote_id_foreign";`);
    this.addSql(`alter table "sales_document_tag_assignments" add constraint "sales_document_tag_assignments_quote_id_foreign" foreign key ("quote_id") references "sales_quotes" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table if exists "sales_document_addresses" drop constraint if exists "sales_document_addresses_order_id_foreign";`);
    this.addSql(`alter table "sales_document_addresses" add constraint "sales_document_addresses_order_id_foreign" foreign key ("order_id") references "sales_orders" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table if exists "sales_document_addresses" drop constraint if exists "sales_document_addresses_quote_id_foreign";`);
    this.addSql(`alter table "sales_document_addresses" add constraint "sales_document_addresses_quote_id_foreign" foreign key ("quote_id") references "sales_quotes" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table if exists "sales_credit_memos" drop constraint if exists "sales_credit_memos_order_id_foreign";`);
    this.addSql(`alter table "sales_credit_memos" add constraint "sales_credit_memos_order_id_foreign" foreign key ("order_id") references "sales_orders" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table if exists "sales_credit_memos" drop constraint if exists "sales_credit_memos_invoice_id_foreign";`);
    this.addSql(`alter table "sales_credit_memos" add constraint "sales_credit_memos_invoice_id_foreign" foreign key ("invoice_id") references "sales_invoices" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table if exists "sales_credit_memo_lines" drop constraint if exists "sales_credit_memo_lines_credit_memo_id_foreign";`);
    this.addSql(`alter table "sales_credit_memo_lines" add constraint "sales_credit_memo_lines_credit_memo_id_foreign" foreign key ("credit_memo_id") references "sales_credit_memos" ("id") on update cascade;`);
    this.addSql(`alter table if exists "sales_credit_memo_lines" drop constraint if exists "sales_credit_memo_lines_order_line_id_foreign";`);
    this.addSql(`alter table "sales_credit_memo_lines" add constraint "sales_credit_memo_lines_order_line_id_foreign" foreign key ("order_line_id") references "sales_order_lines" ("id") on update cascade on delete set null;`);
  }

  override async down(): Promise<void> {}
}
