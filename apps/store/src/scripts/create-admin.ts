import { users } from "@prepareos/data";
import * as schema from "@prepareos/data/schema";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

// ============ CONFIG ============

const connectionString =
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5432/store";

const client = postgres(connectionString);
const db = drizzle(client, { schema });

// Standalone auth instance for this script
const auth = betterAuth({
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
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "staff" },
      tenantId: { type: "string", required: false },
    },
  },
});

// ============ MAIN ============

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Admin";

  if (!email || !password) {
    console.error(
      "Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... [ADMIN_NAME=...] pnpm create-admin",
    );
    console.error("\nRequired:");
    console.error("  ADMIN_EMAIL      Email for the admin account");
    console.error("  ADMIN_PASSWORD   Password (min 8 characters)");
    console.error("\nOptional:");
    console.error('  ADMIN_NAME       Display name (defaults to "Admin")');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Error: Password must be at least 8 characters.");
    process.exit(1);
  }

  // Check if user already exists
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existing) {
    console.error(`Error: User with email "${email}" already exists.`);
    console.log(`  ID: ${existing.id}`);
    console.log(`  Role: ${existing.role}`);
    process.exit(1);
  }

  // Create platform admin via Better Auth (no tenantId — admin spans all tenants)
  console.log(`Creating platform admin: ${email}...`);

  const result = await auth.api.signUpEmail({
    body: { email, password, name },
  });

  if (!result.user) {
    console.error("Error: Failed to create user via Better Auth.");
    process.exit(1);
  }

  // Set role to admin (tenantId stays null)
  await db
    .update(users)
    .set({ role: "admin" })
    .where(eq(users.id, result.user.id));

  console.log("\nPlatform admin created successfully!");
  console.log(`  Email:  ${email}`);
  console.log(`  Name:   ${name}`);
  console.log(`  Role:   admin (no tenant — full platform access)`);

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
