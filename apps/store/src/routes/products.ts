import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createProductSchema,
  updateProductSchema,
  productFiltersSchema,
  createVariantSchema,
  updateVariantSchema,
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

// ── Variant routes ──

products.get("/:id/variants", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const productId = c.req.param("id");
  const variants = await productService.listVariants(tenantId, productId);

  if (variants === null) {
    return c.json({ error: "Product not found" }, 404);
  }

  return c.json(variants);
});

products.post(
  "/:id/variants",
  ownerOrAdmin,
  zValidator("json", createVariantSchema),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const productId = c.req.param("id");
    const data = c.req.valid("json");
    const variant = await productService.createVariant(tenantId, productId, data);

    if (!variant) {
      return c.json({ error: "Product not found" }, 404);
    }

    return c.json(variant, 201);
  },
);

products.patch(
  "/:id/variants/:variantId",
  ownerOrAdmin,
  zValidator("json", updateVariantSchema),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const productId = c.req.param("id");
    const variantId = c.req.param("variantId");
    const data = c.req.valid("json");
    const variant = await productService.updateVariant(tenantId, productId, variantId, data);

    if (!variant) {
      return c.json({ error: "Variant not found" }, 404);
    }

    return c.json(variant);
  },
);

products.delete("/:id/variants/:variantId", ownerOrAdmin, async (c) => {
  const tenantId = c.get("tenantId") as string;
  const productId = c.req.param("id");
  const variantId = c.req.param("variantId");
  const deleted = await productService.deleteVariant(tenantId, productId, variantId);

  if (!deleted) {
    return c.json({ error: "Variant not found" }, 404);
  }

  return c.json({ success: true });
});

export default products;
