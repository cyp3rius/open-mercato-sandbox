import { Migration } from '@mikro-orm/migrations';

export class Migration20260410145838 extends Migration {

  override async up(): Promise<void> {

    this.addSql(`alter table if exists "staff_leave_requests" drop constraint if exists "staff_leave_requests_member_id_foreign";`);
    this.addSql(`alter table "staff_leave_requests" add constraint "staff_leave_requests_member_id_foreign" foreign key ("member_id") references "staff_team_members" ("id") on update cascade;`);

    this.addSql(`alter table if exists "staff_team_member_activities" drop constraint if exists "staff_team_member_activities_member_id_foreign";`);
    this.addSql(`alter table "staff_team_member_activities" add constraint "staff_team_member_activities_member_id_foreign" foreign key ("member_id") references "staff_team_members" ("id") on update cascade;`);

    this.addSql(`alter table if exists "staff_team_member_addresses" drop constraint if exists "staff_team_member_addresses_member_id_foreign";`);
    this.addSql(`alter table "staff_team_member_addresses" add constraint "staff_team_member_addresses_member_id_foreign" foreign key ("member_id") references "staff_team_members" ("id") on update cascade;`);

    this.addSql(`alter table if exists "staff_team_member_comments" drop constraint if exists "staff_team_member_comments_member_id_foreign";`);
    this.addSql(`alter table "staff_team_member_comments" add constraint "staff_team_member_comments_member_id_foreign" foreign key ("member_id") references "staff_team_members" ("id") on update cascade;`);

    this.addSql(`alter table if exists "staff_team_member_job_histories" drop constraint if exists "staff_team_member_job_histories_member_id_foreign";`);
    this.addSql(`alter table "staff_team_member_job_histories" add constraint "staff_team_member_job_histories_member_id_foreign" foreign key ("member_id") references "staff_team_members" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {}
}
