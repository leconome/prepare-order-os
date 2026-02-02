import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260202164358 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "pos_ticket_counter" drop constraint if exists "pos_ticket_counter_date_key_unique";`);
    this.addSql(`alter table if exists "pos_order" drop constraint if exists "pos_order_ticket_number_unique";`);
    this.addSql(`create table if not exists "pos_employee" ("id" text not null, "first_name" text not null, "last_name" text not null, "pin" text not null, "role" text check ("role" in ('cashier', 'manager', 'kitchen')) not null default 'cashier', "is_active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pos_employee_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pos_employee_deleted_at" ON "pos_employee" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "pos_order" ("id" text not null, "ticket_number" text not null, "payment_status" text check ("payment_status" in ('pending', 'paid', 'partially_paid', 'refunded')) not null default 'pending', "preparation_status" text check ("preparation_status" in ('pending', 'in_preparation', 'ready', 'picked_up')) not null default 'pending', "pickup_date" timestamptz null, "pickup_time_start" text null, "pickup_time_end" text null, "client_note" text null, "internal_note" text null, "order_id" text not null, "created_by_id" text not null, "assigned_to_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pos_order_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_pos_order_ticket_number_unique" ON "pos_order" ("ticket_number") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pos_order_ticket_number" ON "pos_order" ("ticket_number") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pos_order_created_by_id" ON "pos_order" ("created_by_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pos_order_assigned_to_id" ON "pos_order" ("assigned_to_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pos_order_deleted_at" ON "pos_order" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "pos_ticket_counter" ("id" text not null, "date_key" text not null, "current_number" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pos_ticket_counter_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_pos_ticket_counter_date_key_unique" ON "pos_ticket_counter" ("date_key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pos_ticket_counter_deleted_at" ON "pos_ticket_counter" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "pos_order" add constraint "pos_order_created_by_id_foreign" foreign key ("created_by_id") references "pos_employee" ("id") on update cascade;`);
    this.addSql(`alter table if exists "pos_order" add constraint "pos_order_assigned_to_id_foreign" foreign key ("assigned_to_id") references "pos_employee" ("id") on update cascade on delete set null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "pos_order" drop constraint if exists "pos_order_created_by_id_foreign";`);

    this.addSql(`alter table if exists "pos_order" drop constraint if exists "pos_order_assigned_to_id_foreign";`);

    this.addSql(`drop table if exists "pos_employee" cascade;`);

    this.addSql(`drop table if exists "pos_order" cascade;`);

    this.addSql(`drop table if exists "pos_ticket_counter" cascade;`);
  }

}
