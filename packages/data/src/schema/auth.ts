import {
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Unified role enum: admin (devs), owner (store owners), staff (employees)
export const userRoleEnum = pgEnum("user_role", ["admin", "owner", "staff"]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: userRoleEnum("role").notNull().default("staff"),
  // PIN for staff login (4 digits, hashed)
  pin: varchar("pin", { length: 255 }),
  // Active status (for disabling accounts)
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Drizzle types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

// Zod schemas
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const insertSessionSchema = createInsertSchema(sessions);
export const selectSessionSchema = createSelectSchema(sessions);
export const insertAccountSchema = createInsertSchema(accounts);
export const selectAccountSchema = createSelectSchema(accounts);

// Role schema
export const userRoleSchema = z.enum(["admin", "owner", "staff"]);
export type UserRole = z.infer<typeof userRoleSchema>;

// PIN auth schema
export const pinAuthSchema = z.object({
  pin: z.string().length(4).regex(/^\d+$/, "PIN must be 4 digits"),
});
export type PinAuth = z.infer<typeof pinAuthSchema>;

// PIN login schema (for staff login endpoint)
export const pinLoginSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  pin: z.string().length(4).regex(/^\d+$/, "PIN must be 4 digits"),
});
export type PinLogin = z.infer<typeof pinLoginSchema>;

// User reference type for relations (used in orders)
export type UserRef = {
  id: string;
  name: string | null;
} | null;

// Staff filters schema (for listing staff users)
export const staffFiltersSchema = z.object({
  role: userRoleSchema.optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type StaffFilters = z.infer<typeof staffFiltersSchema>;

// Create staff schema (for creating users with PIN)
export const createStaffSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  pin: z.string().length(4).regex(/^\d+$/, "PIN must be 4 digits"),
  role: userRoleSchema.default("staff"),
  isActive: z.boolean().default(true),
});
export type CreateStaff = z.infer<typeof createStaffSchema>;

// Update staff schema
export const updateStaffSchema = z.object({
  name: z.string().min(1).optional(),
  pin: z.string().length(4).regex(/^\d+$/, "PIN must be 4 digits").optional(),
  role: userRoleSchema.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateStaff = z.infer<typeof updateStaffSchema>;
