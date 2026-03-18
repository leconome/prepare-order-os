import { zValidator } from "@hono/zod-validator";
import {
  createVariantSchema,
  updateVariantSchema,
  upsertVariantsSchema,
} from "@prepareos/data";
import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { ownerOrAdmin } from "../middleware/role-guard.js";
import * as variantService from "../services/variant.service.js";
import type { AppEnv } from "../types.js";

const variants = new Hono<AppEnv>();

// All variant routes require authentication
variants.use("/*", authMiddleware);

// GET /api/products/:productId/variants
variants.get("/:productId/variants", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const productId = c.req.param("productId");
  const data = await variantService.listVariants(tenantId, productId);
  return c.json(data);
});

// POST /api/products/:productId/variants
variants.post(
  "/:productId/variants",
  ownerOrAdmin,
  zValidator("json", createVariantSchema),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const productId = c.req.param("productId");
    const data = c.req.valid("json");
    const variant = await variantService.createVariant(
      tenantId,
      productId,
      data,
    );
    return c.json(variant, 201);
  },
);

// PUT /api/products/:productId/variants (bulk upsert)
variants.put(
  "/:productId/variants",
  ownerOrAdmin,
  zValidator("json", upsertVariantsSchema),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const productId = c.req.param("productId");
    const data = c.req.valid("json");
    const result = await variantService.upsertVariants(
      tenantId,
      productId,
      data,
    );
    return c.json(result);
  },
);

// PATCH /api/products/:productId/variants/:variantId
variants.patch(
  "/:productId/variants/:variantId",
  ownerOrAdmin,
  zValidator("json", updateVariantSchema),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const variantId = c.req.param("variantId");
    const data = c.req.valid("json");
    const variant = await variantService.updateVariant(
      tenantId,
      variantId,
      data,
    );
    if (!variant) return c.json({ error: "Variant not found" }, 404);
    return c.json(variant);
  },
);

// DELETE /api/products/:productId/variants/:variantId
variants.delete("/:productId/variants/:variantId", ownerOrAdmin, async (c) => {
  const tenantId = c.get("tenantId") as string;
  const variantId = c.req.param("variantId");
  const deleted = await variantService.deleteVariant(tenantId, variantId);
  if (!deleted) return c.json({ error: "Variant not found" }, 404);
  return c.json({ success: true });
});

export default variants;
