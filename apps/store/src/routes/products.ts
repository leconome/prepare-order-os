import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createProductSchema,
  updateProductSchema,
  productFiltersSchema,
} from "@prepareos/data";
import { deleteImage } from "../lib/storage.js";
import { authMiddleware } from "../middleware/auth.js";
import { ownerOrAdmin } from "../middleware/role-guard.js";
import * as productService from "../services/product.service.js";
import type { AppEnv } from "../types.js";

const products = new Hono<AppEnv>();

products.use("*", authMiddleware);

products.get("/", zValidator("query", productFiltersSchema), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const filters = c.req.valid("query");
  const result = await productService.listProducts(tenantId, filters);
  return c.json(result);
});

products.get("/:id", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const id = c.req.param("id");
  const product = await productService.getProductById(tenantId, id);

  if (!product) {
    return c.json({ error: "Product not found" }, 404);
  }

  return c.json(product);
});

products.post(
  "/",
  ownerOrAdmin,
  zValidator("json", createProductSchema),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const data = c.req.valid("json");
    const product = await productService.createProduct(tenantId, data);
    return c.json(product, 201);
  },
);

products.patch(
  "/:id",
  ownerOrAdmin,
  zValidator("json", updateProductSchema),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await productService.getProductById(tenantId, id);
    if (!existing) {
      return c.json({ error: "Product not found" }, 404);
    }

    if (
      data.imageUrl !== undefined &&
      existing.imageUrl &&
      data.imageUrl !== existing.imageUrl
    ) {
      await deleteImage(existing.imageUrl);
    }

    const product = await productService.updateProduct(tenantId, id, data);
    return c.json(product);
  },
);

products.delete("/:id", ownerOrAdmin, async (c) => {
  const tenantId = c.get("tenantId") as string;
  const id = c.req.param("id");

  const existing = await productService.getProductById(tenantId, id);
  if (!existing) {
    return c.json({ error: "Product not found" }, 404);
  }

  if (existing.imageUrl) {
    await deleteImage(existing.imageUrl);
  }

  await productService.deleteProduct(tenantId, id);
  return c.json({ success: true });
});

export default products;
