import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5434/store";

const client = postgres(connectionString);
export const db = drizzle(client, { schema });

export type Database = typeof db;
