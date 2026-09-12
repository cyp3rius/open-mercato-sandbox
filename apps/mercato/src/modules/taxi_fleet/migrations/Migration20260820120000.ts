import { Migration } from '@mikro-orm/migrations'

export class Migration20260820120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "taxi_fleet_receipt_extractions" (
        "id" uuid not null default gen_random_uuid(),
        "tenant_id" uuid not null,
        "organization_id" uuid not null,
        "attachment_id" uuid not null,
        "trip_id" uuid null,
        "financial_entry_id" uuid null,
        "status" text not null default 'pending',
        "driver_document_number" text null,
        "driver_amount" numeric(14,2) null,
        "ocr_document_number" text null,
        "ocr_gross_amount" numeric(14,2) null,
        "ocr_buyer_nip" text null,
        "ocr_seller_nip" text null,
        "ocr_occurred_at" timestamptz null,
        "confidence" numeric(4,3) null,
        "raw_text_excerpt" text null,
        "model" text null,
        "warnings_json" jsonb null,
        "resolved_company_id" uuid null,
        "applied_document_number" text null,
        "error_message" text null,
        "processed_at" timestamptz null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        constraint "taxi_fleet_receipt_extractions_pkey" primary key ("id")
      );
    `)
    this.addSql(
      `create index if not exists "taxi_fleet_receipt_extractions_scope_idx" on "taxi_fleet_receipt_extractions" ("tenant_id", "organization_id");`,
    )
    this.addSql(
      `create index if not exists "taxi_fleet_receipt_extractions_attachment_idx" on "taxi_fleet_receipt_extractions" ("attachment_id");`,
    )
    this.addSql(
      `create index if not exists "taxi_fleet_receipt_extractions_trip_idx" on "taxi_fleet_receipt_extractions" ("trip_id");`,
    )
    this.addSql(
      `create index if not exists "taxi_fleet_receipt_extractions_entry_idx" on "taxi_fleet_receipt_extractions" ("financial_entry_id");`,
    )
    this.addSql(
      `create index if not exists "taxi_fleet_receipt_extractions_status_idx" on "taxi_fleet_receipt_extractions" ("status", "tenant_id");`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "taxi_fleet_receipt_extractions" cascade;`)
  }
}
