import { eq, and, ilike, sql, asc, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  menus,
  menuProducts,
  products,
  type CreateMenu,
  type UpdateMenu,
  type MenuFilters,
} from "@prepareos/data";

export async function listMenus(tenantId: string, filters: MenuFilters) {
  const { search, isActive, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  const conditions = [eq(menus.tenantId, tenantId)];

  if (search) {
    conditions.push(ilike(menus.name, `%${search}%`));
  }

  if (isActive !== undefined) {
    conditions.push(eq(menus.isActive, isActive));
  }

  const whereClause = and(...conditions);

  const [data, countResult] = await Promise.all([
    db.query.menus.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [asc(menus.sortOrder), asc(menus.name)],
      with: {
        menuProducts: {
          with: { product: true },
          orderBy: [asc(menuProducts.sortOrder)],
        },
      },
    }),
    db.select({ count: sql<number>`count(*)` }).from(menus).where(whereClause),
  ]);

  const total = Number(countResult[0]?.count ?? 0);

  const menusWithProducts = data.map(({ menuProducts: mp, ...menu }) => ({
    ...menu,
    products: mp.map(({ product, quantity }) => ({ product, quantity })),
  }));

  return {
    data: menusWithProducts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getMenuById(tenantId: string, id: string) {
  const menu = await db.query.menus.findFirst({
    where: and(eq(menus.id, id), eq(menus.tenantId, tenantId)),
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

  const sortedProducts = menuProductEntries
    .map((mp) => {
      const product = menuProductsList.find((p) => p.id === mp.productId);
      if (!product) return null;
      return { product, quantity: mp.quantity };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return { ...menu, products: sortedProducts };
}

export async function createMenu(tenantId: string, data: CreateMenu) {
  const [menu] = await db
    .insert(menus)
    .values({
      name: data.name,
      description: data.description ?? null,
      price: data.price ?? null,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
      tenantId,
    })
    .returning();

  if (data.products && data.products.length > 0) {
    await db.insert(menuProducts).values(
      data.products.map((p, index) => ({
        menuId: menu.id,
        productId: p.productId,
        quantity: p.quantity,
        sortOrder: index,
      })),
    );
  }

  return getMenuById(tenantId, menu.id);
}

export async function updateMenu(tenantId: string, id: string, data: UpdateMenu) {
  const updateData: Partial<typeof menus.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.price !== undefined) updateData.price = data.price;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  await db
    .update(menus)
    .set(updateData)
    .where(and(eq(menus.id, id), eq(menus.tenantId, tenantId)));

  if (data.products !== undefined) {
    await db.delete(menuProducts).where(eq(menuProducts.menuId, id));

    if (data.products.length > 0) {
      await db.insert(menuProducts).values(
        data.products.map((p, index) => ({
          menuId: id,
          productId: p.productId,
          quantity: p.quantity,
          sortOrder: index,
        })),
      );
    }
  }

  return getMenuById(tenantId, id);
}

export async function deleteMenu(tenantId: string, id: string) {
  const [deleted] = await db
    .delete(menus)
    .where(and(eq(menus.id, id), eq(menus.tenantId, tenantId)))
    .returning({ id: menus.id });

  return deleted;
}
