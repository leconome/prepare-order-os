import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createMenuSchema,
  updateMenuSchema,
  menuFiltersSchema,
} from "@repo/store-types";
import * as menuService from "../services/menu.service.js";
import { authMiddleware } from "../middleware/auth.js";
import { managerOrAdmin } from "../middleware/role-guard.js";

const menus = new Hono();

menus.use("*", authMiddleware);

menus.get("/", zValidator("query", menuFiltersSchema), async (c) => {
  const filters = c.req.valid("query");
  const result = await menuService.listMenus(filters);
  return c.json(result);
});

menus.get("/:id", async (c) => {
  const id = c.req.param("id");
  const menu = await menuService.getMenuById(id);

  if (!menu) {
    return c.json({ error: "Menu not found" }, 404);
  }

  return c.json(menu);
});

menus.post(
  "/",
  managerOrAdmin,
  zValidator("json", createMenuSchema),
  async (c) => {
    const data = c.req.valid("json");
    const menu = await menuService.createMenu(data);
    return c.json(menu, 201);
  }
);

menus.patch(
  "/:id",
  managerOrAdmin,
  zValidator("json", updateMenuSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await menuService.getMenuById(id);
    if (!existing) {
      return c.json({ error: "Menu not found" }, 404);
    }

    const menu = await menuService.updateMenu(id, data);
    return c.json(menu);
  }
);

menus.delete("/:id", managerOrAdmin, async (c) => {
  const id = c.req.param("id");

  const existing = await menuService.getMenuById(id);
  if (!existing) {
    return c.json({ error: "Menu not found" }, 404);
  }

  await menuService.deleteMenu(id);
  return c.json({ success: true });
});

export default menus;
