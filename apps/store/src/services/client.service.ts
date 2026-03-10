import { eq, and, sql, ilike, or, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  clients,
  type CreateClient,
  type UpdateClient,
  type ClientFilters,
} from "@prepareos/data";

export async function listClients(tenantId: string, filters: ClientFilters) {
  const { search, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  const tenantCondition = eq(clients.tenantId, tenantId);

  const whereClause = search
    ? and(
        tenantCondition,
        or(
          ilike(clients.name, `%${search}%`),
          ilike(clients.phone, `%${search}%`),
          ilike(clients.email, `%${search}%`)
        )
      )
    : tenantCondition;

  const [data, countResult] = await Promise.all([
    db.query.clients.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [desc(clients.createdAt)],
    }),
    db
      .select({ count: sql<number>`count(*)` })
      .from(clients)
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

export async function getClientById(tenantId: string, id: string) {
  return db.query.clients.findFirst({
    where: and(eq(clients.id, id), eq(clients.tenantId, tenantId)),
  });
}

export async function createClient(tenantId: string, data: CreateClient) {
  const [client] = await db
    .insert(clients)
    .values({
      name: data.name,
      type: data.type ?? "particulier",
      phone: data.phone ?? null,
      email: data.email ?? null,
      notes: data.notes ?? null,
      tenantId,
    })
    .returning();

  return client;
}

export async function updateClient(tenantId: string, id: string, data: UpdateClient) {
  const updateData: Partial<typeof clients.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.notes !== undefined) updateData.notes = data.notes;

  const [client] = await db
    .update(clients)
    .set(updateData)
    .where(and(eq(clients.id, id), eq(clients.tenantId, tenantId)))
    .returning();

  return client;
}

export async function deleteClient(tenantId: string, id: string) {
  const [deleted] = await db
    .delete(clients)
    .where(and(eq(clients.id, id), eq(clients.tenantId, tenantId)))
    .returning({ id: clients.id });

  return deleted;
}
