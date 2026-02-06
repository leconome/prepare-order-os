import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/index.js";
import * as schema from "@prepareos/data/schema";

const isDev = process.env.STAGE === "dev";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  trustedOrigins: process.env.CORS_ORIGINS?.split(",") || [
    "http://localhost:3000",
    "http://localhost:3002",
  ],
  advanced: {
    cookiePrefix: "prepareos",
    defaultCookieAttributes: {
      secure: true,
      sameSite: isDev ? "none" : "lax",
      path: "/",
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "staff",
      },
      tenantId: {
        type: "string",
        required: false,
      },
    },
  },
});

export type Auth = typeof auth;
