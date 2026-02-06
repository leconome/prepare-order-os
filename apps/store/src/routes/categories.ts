import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createCategorySchema,
  updateCategorySchema,
  categoryFiltersSchema,
} from "@prepareos/data";
import * as categoryService from "../services/category.service.js";
import { authMiddleware } from "../middleware/auth.js";
import { ownerOrAdmin } from "../middleware/role-guard.js";
import type { AppEnv } from "../types.js";

const categories = new Hono<AppEnv>();

categories.use("*", authMiddleware);

categories.get("/", zValidator("query", categoryFiltersSchema), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const filters = c.req.valid("query");
  const result = await categoryService.listCategories(tenantId, filters);
  return c.json(result);
});

categories.get("/tree", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const tree = await categoryService.getCategoryTree(tenantId);
  return c.json(tree);
});

categories.get("/:id", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const id = c.req.param("id");
  const category = await categoryService.getCategoryById(tenantId, id);

  if (!category) {
    return c.json({ error: "Category not found" }, 404);
  }

  return c.json(category);
});

categories.post(
  "/",
  ownerOrAdmin,
  zValidator("json", createCategorySchema),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const data = c.req.valid("json");
    const category = await categoryService.createCategory(tenantId, data);
    return c.json(category, 201);
  },
);

categories.patch(
  "/:id",
  ownerOrAdmin,
  zValidator("json", updateCategorySchema),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await categoryService.getCategoryById(tenantId, id);
    if (!existing) {
      return c.json({ error: "Category not found" }, 404);
    }

    const category = await categoryService.updateCategory(tenantId, id, data);
    return c.json(category);
  },
);

categories.delete("/:id", ownerOrAdmin, async (c) => {
  const tenantId = c.get("tenantId") as string;
  const id = c.req.param("id");

  const existing = await categoryService.getCategoryById(tenantId, id);
  if (!existing) {
    return c.json({ error: "Category not found" }, 404);
  }

  await categoryService.deleteCategory(tenantId, id);
  return c.json({ success: true });
});

export default categories;
