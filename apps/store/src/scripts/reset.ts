import { sql } from "drizzle-orm";
import * as schema from "@prepareos/data/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString =
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5432/store";

const client = postgres(connectionString);
const db = drizzle(client, { schema });

async function reset() {
  console.log("Truncating all tables...");

  await db.execute(
    sql`TRUNCATE TABLE order_items, orders, ticket_counters, menu_products, menus, products, categories, clients, accounts, sessions, verifications, users, tenants CASCADE`,
  );

  console.log("All tables emptied.");
  process.exit(0);
}

reset().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
