import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createCategorySchema,
  updateCategorySchema,
  categoryFiltersSchema,
} from "@repo/store-types";
import * as categoryService from "../services/category.service.js";
import { authMiddleware } from "../middleware/auth.js";
import { managerOrAdmin } from "../middleware/role-guard.js";

const categories = new Hono();

categories.use("*", authMiddleware);

categories.get("/", zValidator("query", categoryFiltersSchema), async (c) => {
  const filters = c.req.valid("query");
  const result = await categoryService.listCategories(filters);
  return c.json(result);
});

categories.get("/tree", async (c) => {
  const tree = await categoryService.getCategoryTree();
  return c.json(tree);
});

categories.get("/:id", async (c) => {
  const id = c.req.param("id");
  const category = await categoryService.getCategoryById(id);

  if (!category) {
    return c.json({ error: "Category not found" }, 404);
  }

  return c.json(category);
});

categories.post(
  "/",
  managerOrAdmin,
  zValidator("json", createCategorySchema),
  async (c) => {
    const data = c.req.valid("json");
    const category = await categoryService.createCategory(data);
    return c.json(category, 201);
  }
);

categories.patch(
  "/:id",
  managerOrAdmin,
  zValidator("json", updateCategorySchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await categoryService.getCategoryById(id);
    if (!existing) {
      return c.json({ error: "Category not found" }, 404);
    }

    const category = await categoryService.updateCategory(id, data);
    return c.json(category);
  }
);

categories.delete("/:id", managerOrAdmin, async (c) => {
  const id = c.req.param("id");

  const existing = await categoryService.getCategoryById(id);
  if (!existing) {
    return c.json({ error: "Category not found" }, 404);
  }

  await categoryService.deleteCategory(id);
  return c.json({ success: true });
});

export default categories;
