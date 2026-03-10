import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createPointOfSaleSchema,
  updatePointOfSaleSchema,
  pointOfSaleFiltersSchema,
} from "@prepareos/data";
import * as posService from "../services/point-of-sale.service.js";
import { authMiddleware } from "../middleware/auth.js";
import { ownerOrAdmin } from "../middleware/role-guard.js";
import type { AppEnv } from "../types.js";

const pointsOfSale = new Hono<AppEnv>();

pointsOfSale.use("*", authMiddleware);

pointsOfSale.get("/", zValidator("query", pointOfSaleFiltersSchema), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const filters = c.req.valid("query");
  const result = await posService.listPointsOfSale(tenantId, filters);
  return c.json(result);
});

pointsOfSale.get("/:id", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const id = c.req.param("id");
  const pos = await posService.getPointOfSaleById(tenantId, id);

  if (!pos) {
    return c.json({ error: "Point of sale not found" }, 404);
  }

  return c.json(pos);
});

pointsOfSale.post(
  "/",
  ownerOrAdmin,
  zValidator("json", createPointOfSaleSchema),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const data = c.req.valid("json");
    const pos = await posService.createPointOfSale(tenantId, data);
    return c.json(pos, 201);
  },
);

pointsOfSale.patch(
  "/:id",
  ownerOrAdmin,
  zValidator("json", updatePointOfSaleSchema),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await posService.getPointOfSaleById(tenantId, id);
    if (!existing) {
      return c.json({ error: "Point of sale not found" }, 404);
    }

    const pos = await posService.updatePointOfSale(tenantId, id, data);
    return c.json(pos);
  },
);

pointsOfSale.delete("/:id", ownerOrAdmin, async (c) => {
  const tenantId = c.get("tenantId") as string;
  const id = c.req.param("id");

  const existing = await posService.getPointOfSaleById(tenantId, id);
  if (!existing) {
    return c.json({ error: "Point of sale not found" }, 404);
  }

  const orderCount = await posService.countOrdersByPointOfSale(tenantId, id);
  if (orderCount > 0) {
    return c.json(
      { error: "Cannot delete point of sale with existing orders", orderCount },
      409,
    );
  }

  await posService.deletePointOfSale(tenantId, id);
  return c.json({ success: true });
});

export default pointsOfSale;
