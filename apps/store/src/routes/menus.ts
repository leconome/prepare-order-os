import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createMenuSchema,
  updateMenuSchema,
  menuFiltersSchema,
} from "@prepareos/data";
import * as menuService from "../services/menu.service.js";
import { authMiddleware } from "../middleware/auth.js";
import { ownerOrAdmin } from "../middleware/role-guard.js";
import type { AppEnv } from "../types.js";

const menus = new Hono<AppEnv>();

menus.use("*", authMiddleware);

menus.get("/", zValidator("query", menuFiltersSchema), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const filters = c.req.valid("query");
  const result = await menuService.listMenus(tenantId, filters);
  return c.json(result);
});

menus.get("/:id", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const id = c.req.param("id");
  const menu = await menuService.getMenuById(tenantId, id);

  if (!menu) {
    return c.json({ error: "Menu not found" }, 404);
  }

  return c.json(menu);
});

menus.post(
  "/",
  ownerOrAdmin,
  zValidator("json", createMenuSchema),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const data = c.req.valid("json");
    const menu = await menuService.createMenu(tenantId, data);
    return c.json(menu, 201);
  },
);

menus.patch(
  "/:id",
  ownerOrAdmin,
  zValidator("json", updateMenuSchema),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await menuService.getMenuById(tenantId, id);
    if (!existing) {
      return c.json({ error: "Menu not found" }, 404);
    }

    const menu = await menuService.updateMenu(tenantId, id, data);
    return c.json(menu);
  },
);

menus.delete("/:id", ownerOrAdmin, async (c) => {
  const tenantId = c.get("tenantId") as string;
  const id = c.req.param("id");

  const existing = await menuService.getMenuById(tenantId, id);
  if (!existing) {
    return c.json({ error: "Menu not found" }, 404);
  }

  await menuService.deleteMenu(tenantId, id);
  return c.json({ success: true });
});

export default menus;
