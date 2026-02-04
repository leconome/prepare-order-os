import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "../../packages/data/dist/schema/index.js",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      "postgres://postgres:postgres@localhost:5432/store",
  },
});
