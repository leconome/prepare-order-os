import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createOrderSchema,
  updateOrderSchema,
  updateOrderStatusSchema,
  orderFiltersSchema,
  toggleItemPreparedSchema,
} from "@prepareos/data";
import * as orderService from "../services/order.service.js";
import { authMiddleware } from "../middleware/auth.js";
import type { AppEnv } from "../types.js";

const orders = new Hono<AppEnv>();

orders.use("*", authMiddleware);

orders.get("/", zValidator("query", orderFiltersSchema), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const filters = c.req.valid("query");
  const result = await orderService.listOrders(tenantId, filters);
  return c.json(result);
});

orders.get("/:id", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const id = c.req.param("id");
  const order = await orderService.getOrderById(tenantId, id);

  if (!order) {
    return c.json({ error: "Order not found" }, 404);
  }

  return c.json(order);
});

orders.post("/", zValidator("json", createOrderSchema), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const data = c.req.valid("json");
  // Auto-fill createdById from logged-in user
  const user = c.get("user");

  const orderData = {
    ...data,
    createdById: data.createdById ?? user.id,
  };

  const order = await orderService.createOrder(tenantId, orderData);
  return c.json(order, 201);
});

orders.patch("/:id", zValidator("json", updateOrderSchema), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const id = c.req.param("id");
  const data = c.req.valid("json");

  const existing = await orderService.getOrderById(tenantId, id);
  if (!existing) {
    return c.json({ error: "Order not found" }, 404);
  }

  if (
    data.items &&
    ["ready", "picked_up"].includes(existing.preparationStatus)
  ) {
    return c.json(
      { error: "Cannot modify items on a completed order" },
      409,
    );
  }

  const order = await orderService.updateOrder(tenantId, id, data);
  return c.json(order);
});

orders.patch(
  "/:id/status",
  zValidator("json", updateOrderStatusSchema),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await orderService.getOrderById(tenantId, id);
    if (!existing) {
      return c.json({ error: "Order not found" }, 404);
    }

    const order = await orderService.updateOrderStatus(tenantId, id, data);
    return c.json(order);
  },
);

orders.patch(
  "/:id/items/:itemId/prepared",
  zValidator("json", toggleItemPreparedSchema),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const id = c.req.param("id");
    const itemId = c.req.param("itemId");
    const { isPrepared } = c.req.valid("json");

    const order = await orderService.toggleItemPrepared(
      tenantId,
      id,
      itemId,
      isPrepared,
    );

    if (!order) {
      return c.json({ error: "Order or item not found" }, 404);
    }

    return c.json(order);
  },
);

orders.patch(
  "/:id/menu-items/:menuItemId/prepared",
  zValidator("json", toggleItemPreparedSchema),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const id = c.req.param("id");
    const menuItemId = c.req.param("menuItemId");
    const { isPrepared } = c.req.valid("json");

    const order = await orderService.toggleMenuItemPrepared(
      tenantId,
      id,
      menuItemId,
      isPrepared,
    );

    if (!order) {
      return c.json({ error: "Order or menu item not found" }, 404);
    }

    return c.json(order);
  },
);

orders.delete("/:id", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const id = c.req.param("id");

  const existing = await orderService.getOrderById(tenantId, id);
  if (!existing) {
    return c.json({ error: "Order not found" }, 404);
  }

  await orderService.deleteOrder(tenantId, id);
  return c.json({ success: true });
});

export default orders;
