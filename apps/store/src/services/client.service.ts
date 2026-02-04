import { eq, sql, ilike, or, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  clients,
  type CreateClient,
  type UpdateClient,
  type ClientFilters,
} from "@prepareos/data";

export async function listClients(filters: ClientFilters) {
  const { search, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  const whereClause = search
    ? or(
        ilike(clients.name, `%${search}%`),
        ilike(clients.phone, `%${search}%`),
        ilike(clients.email, `%${search}%`)
      )
    : undefined;

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

export async function getClientById(id: string) {
  return db.query.clients.findFirst({
    where: eq(clients.id, id),
  });
}

export async function createClient(data: CreateClient) {
  const [client] = await db
    .insert(clients)
    .values({
      name: data.name,
      phone: data.phone ?? null,
      email: data.email ?? null,
      notes: data.notes ?? null,
    })
    .returning();

  return client;
}

export async function updateClient(id: string, data: UpdateClient) {
  const updateData: Partial<typeof clients.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.notes !== undefined) updateData.notes = data.notes;

  const [client] = await db
    .update(clients)
    .set(updateData)
    .where(eq(clients.id, id))
    .returning();

  return client;
}

export async function deleteClient(id: string) {
  const [deleted] = await db
    .delete(clients)
    .where(eq(clients.id, id))
    .returning({ id: clients.id });

  return deleted;
}
