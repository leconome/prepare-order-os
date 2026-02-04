import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const employeeRoleEnum = pgEnum("employee_role", [
  "cashier",
  "manager",
  "kitchen",
]);

export const employees = pgTable("employees", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  pin: varchar("pin", { length: 255 }).notNull(),
  role: employeeRoleEnum("role").notNull().default("cashier"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Drizzle types
export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;

// Zod schemas from drizzle-zod
export const insertEmployeeSchema = createInsertSchema(employees);
export const selectEmployeeSchema = createSelectSchema(employees);

// Role schema
export const employeeRoleSchema = z.enum(["cashier", "manager", "kitchen"]);

// Custom schemas for API
export const createEmployeeSchema = z.object({
  name: z.string().min(1).max(100),
  pin: z.string().length(4).regex(/^\d+$/, "PIN must be 4 digits"),
  role: employeeRoleSchema,
  isActive: z.boolean().default(true),
});

export const updateEmployeeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  pin: z.string().length(4).regex(/^\d+$/, "PIN must be 4 digits").optional(),
  role: employeeRoleSchema.optional(),
  isActive: z.boolean().optional(),
});

export const employeeFiltersSchema = z.object({
  role: employeeRoleSchema.optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const pinAuthSchema = z.object({
  pin: z.string().length(4).regex(/^\d+$/, "PIN must be 4 digits"),
});

// Types
export type EmployeeRole = z.infer<typeof employeeRoleSchema>;
export type CreateEmployee = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployee = z.infer<typeof updateEmployeeSchema>;
export type EmployeeFilters = z.infer<typeof employeeFiltersSchema>;
export type PinAuth = z.infer<typeof pinAuthSchema>;
