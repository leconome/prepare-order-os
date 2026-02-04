import { eq, and, ilike, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { employees } from "../db/schema/index.js";
import type {
  CreateEmployee,
  UpdateEmployee,
  EmployeeFilters,
} from "@repo/store-types";

export async function listEmployees(filters: EmployeeFilters) {
  const { role, isActive, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  const conditions = [];

  if (role) {
    conditions.push(eq(employees.role, role));
  }

  if (isActive !== undefined) {
    conditions.push(eq(employees.isActive, isActive));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db.query.employees.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: employees.name,
      columns: {
        pin: false,
      },
    }),
    db
      .select({ count: sql<number>`count(*)` })
      .from(employees)
      .where(whereClause),
  ]);

  const total = Number(countResult[0]?.count ?? 0);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getEmployeeById(id: string) {
  return db.query.employees.findFirst({
    where: eq(employees.id, id),
    columns: {
      pin: false,
    },
  });
}

export async function createEmployee(data: CreateEmployee) {
  const [employee] = await db
    .insert(employees)
    .values({
      name: data.name,
      pin: data.pin,
      role: data.role,
      isActive: data.isActive ?? true,
    })
    .returning({
      id: employees.id,
      name: employees.name,
      role: employees.role,
      isActive: employees.isActive,
      createdAt: employees.createdAt,
      updatedAt: employees.updatedAt,
    });

  return employee;
}

export async function updateEmployee(id: string, data: UpdateEmployee) {
  const updateData: Partial<typeof employees.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.pin !== undefined) updateData.pin = data.pin;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const [employee] = await db
    .update(employees)
    .set(updateData)
    .where(eq(employees.id, id))
    .returning({
      id: employees.id,
      name: employees.name,
      role: employees.role,
      isActive: employees.isActive,
      createdAt: employees.createdAt,
      updatedAt: employees.updatedAt,
    });

  return employee;
}

export async function deleteEmployee(id: string) {
  const [deleted] = await db
    .delete(employees)
    .where(eq(employees.id, id))
    .returning({ id: employees.id });

  return deleted;
}

export async function verifyPin(pin: string) {
  return db.query.employees.findFirst({
    where: and(eq(employees.pin, pin), eq(employees.isActive, true)),
    columns: {
      id: true,
      name: true,
      role: true,
    },
  });
}
