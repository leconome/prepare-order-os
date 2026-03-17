import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/index.js";
import * as schema from "@prepareos/data/schema";

const baseDomain = process.env.BASE_DOMAIN || "localhost";
const isLocalhost = baseDomain === "localhost";

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
  trustedOrigins: (request) => {
    const explicit = process.env.CORS_ORIGINS?.split(",") || [
      "http://localhost:3000",
      "http://localhost:3002",
    ];
    // Also trust any subdomain of baseDomain (e.g. *.localhost, *.prepareos.fr)
    const origin = request?.headers.get("origin");
    if (origin) {
      try {
        const url = new URL(origin);
        if (url.hostname.endsWith(`.${baseDomain}`)) {
          explicit.push(origin);
        }
      } catch {
        // invalid origin
      }
    }
    return explicit;
  },
  advanced: {
    cookiePrefix: "prepareos",
    // In production, API is on api.prepareos.fr while clients are on *.prepareos.fr
    // so we need cross-subdomain cookies. In dev, same-hostname is used (no need).
    ...(isLocalhost
      ? {}
      : {
          crossSubDomainCookies: {
            enabled: true,
            domain: baseDomain,
          },
        }),
    defaultCookieAttributes: {
      secure: !isLocalhost,
      sameSite: isLocalhost ? "lax" : "none",
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
