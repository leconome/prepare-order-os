import { z } from "zod";

export const employeeRoleSchema = z.enum(["cashier", "manager", "kitchen"]);

export const employeeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  pin: z.string(),
  role: employeeRoleSchema,
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const employeePublicSchema = employeeSchema.omit({ pin: true });

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

export type EmployeeRole = z.infer<typeof employeeRoleSchema>;
export type Employee = z.infer<typeof employeeSchema>;
export type EmployeePublic = z.infer<typeof employeePublicSchema>;
export type CreateEmployee = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployee = z.infer<typeof updateEmployeeSchema>;
export type EmployeeFilters = z.infer<typeof employeeFiltersSchema>;
export type PinAuth = z.infer<typeof pinAuthSchema>;
