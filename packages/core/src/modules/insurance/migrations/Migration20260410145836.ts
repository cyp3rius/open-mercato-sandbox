import { Migration } from '@mikro-orm/migrations';

export class Migration20260410145836 extends Migration {

  override async up(): Promise<void> {

    this.addSql(`alter table "insurance_insurer_contacts" drop constraint if exists "insurance_insurer_contacts_insurer_fk";`);

    this.addSql(`alter table "insurance_policies" drop constraint if exists "insurance_policies_insurer_contact_fk";`);
    this.addSql(`alter table "insurance_policies" drop constraint if exists "insurance_policies_insurer_fk";`);

    this.addSql(`drop index if exists "insurance_insurers_code_scope_unique";`);

    this.addSql(`alter table "insurance_insurer_contacts" add constraint "insurance_insurer_contacts_insurer_id_foreign" foreign key ("insurer_id") references "insurance_insurers" ("id") on update cascade on delete cascade;`);

    this.addSql(`drop index if exists "insurance_policies_caretaker_user_idx";`);
    this.addSql(`drop index if exists "insurance_policies_insured_company_idx";`);
    this.addSql(`drop index if exists "insurance_policies_insured_person_idx";`);
    this.addSql(`drop index if exists "insurance_policies_resource_idx";`);

    this.addSql(`alter table "insurance_policies" add constraint "insurance_policies_insurer_id_foreign" foreign key ("insurer_id") references "insurance_insurers" ("id") on update cascade on delete restrict;`);
    this.addSql(`alter table "insurance_policies" add constraint "insurance_policies_insurer_contact_id_foreign" foreign key ("insurer_contact_id") references "insurance_insurer_contacts" ("id") on update cascade on delete set null;`);
  }

  override async down(): Promise<void> {}
}
