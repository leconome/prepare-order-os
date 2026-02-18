import { defineConfig } from "drizzle-kit";

console.log("Running Drizzle configuration...");

const connectionString =
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5432/store";

console.log("Using database connection string:", connectionString);

export default defineConfig({
  schema: "../../packages/data/dist/schema/index.js",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
