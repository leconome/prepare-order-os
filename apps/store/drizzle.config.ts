import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "../../packages/data/src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      "postgres://postgres:postgres@localhost:5432/store",
  },
});
