import { eq, and, sql, asc, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { menus, menuProducts, products } from "../db/schema/index.js";
import type { CreateMenu, UpdateMenu, MenuFilters } from "@repo/store-types";

export async function listMenus(filters: MenuFilters) {
  const { isActive, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  const conditions = [];

  if (isActive !== undefined) {
    conditions.push(eq(menus.isActive, isActive));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db.query.menus.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [asc(menus.sortOrder), asc(menus.name)],
    }),
    db.select({ count: sql<number>`count(*)` }).from(menus).where(whereClause),
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

export async function getMenuById(id: string) {
  const menu = await db.query.menus.findFirst({
    where: eq(menus.id, id),
  });

  if (!menu) return null;

  const menuProductEntries = await db.query.menuProducts.findMany({
    where: eq(menuProducts.menuId, id),
    orderBy: asc(menuProducts.sortOrder),
  });

  if (menuProductEntries.length === 0) {
    return { ...menu, products: [] };
  }

  const productIds = menuProductEntries.map((mp) => mp.productId);
  const menuProductsList = await db.query.products.findMany({
    where: inArray(products.id, productIds),
  });

  const sortedProducts = productIds
    .map((pid) => menuProductsList.find((p) => p.id === pid))
    .filter(Boolean);

  return { ...menu, products: sortedProducts };
}

export async function createMenu(data: CreateMenu) {
  const [menu] = await db
    .insert(menus)
    .values({
      name: data.name,
      description: data.description ?? null,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
    })
    .returning();

  if (data.productIds && data.productIds.length > 0) {
    await db.insert(menuProducts).values(
      data.productIds.map((productId, index) => ({
        menuId: menu.id,
        productId,
        sortOrder: index,
      })),
    );
  }

  return getMenuById(menu.id);
}

export async function updateMenu(id: string, data: UpdateMenu) {
  const updateData: Partial<typeof menus.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  await db.update(menus).set(updateData).where(eq(menus.id, id));

  if (data.productIds !== undefined) {
    await db.delete(menuProducts).where(eq(menuProducts.menuId, id));

    if (data.productIds.length > 0) {
      await db.insert(menuProducts).values(
        data.productIds.map((productId, index) => ({
          menuId: id,
          productId,
          sortOrder: index,
        })),
      );
    }
  }

  return getMenuById(id);
}

export async function deleteMenu(id: string) {
  const [deleted] = await db
    .delete(menus)
    .where(eq(menus.id, id))
    .returning({ id: menus.id });

  return deleted;
}
