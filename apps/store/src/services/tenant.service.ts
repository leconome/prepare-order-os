import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { tenants, type UpdateTenantSettings } from "@prepareos/data";

export async function getTenant(tenantId: string) {
  return db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });
}

export async function updateTenantSettings(
  tenantId: string,
  data: UpdateTenantSettings,
) {
  const updateData: Partial<typeof tenants.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.preparationFilterDays !== undefined)
    updateData.preparationFilterDays = data.preparationFilterDays;

  const [updated] = await db
    .update(tenants)
    .set(updateData)
    .where(eq(tenants.id, tenantId))
    .returning();

  return updated;
}
