import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createOrderSchema,
  updateOrderSchema,
  updateOrderStatusSchema,
  orderFiltersSchema,
} from "@repo/store-types";
import * as orderService from "../services/order.service.js";
import { authMiddleware } from "../middleware/auth.js";
import { optionalPinAuthMiddleware } from "../middleware/pin-auth.js";

const orders = new Hono();

orders.use("*", authMiddleware);

orders.get("/", zValidator("query", orderFiltersSchema), async (c) => {
  const filters = c.req.valid("query");
  const result = await orderService.listOrders(filters);
  return c.json(result);
});

orders.get("/:id", async (c) => {
  const id = c.req.param("id");
  const order = await orderService.getOrderById(id);

  if (!order) {
    return c.json({ error: "Order not found" }, 404);
  }

  return c.json(order);
});

orders.post(
  "/",
  optionalPinAuthMiddleware,
  zValidator("json", createOrderSchema),
  async (c) => {
    const data = c.req.valid("json");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const employee = (c as any).get("employee") as { id: string } | undefined;

    const orderData = {
      ...data,
      createdById: data.createdById ?? employee?.id,
    };

    const order = await orderService.createOrder(orderData);
    return c.json(order, 201);
  }
);

orders.patch("/:id", zValidator("json", updateOrderSchema), async (c) => {
  const id = c.req.param("id");
  const data = c.req.valid("json");

  const existing = await orderService.getOrderById(id);
  if (!existing) {
    return c.json({ error: "Order not found" }, 404);
  }

  const order = await orderService.updateOrder(id, data);
  return c.json(order);
});

orders.patch(
  "/:id/status",
  zValidator("json", updateOrderStatusSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await orderService.getOrderById(id);
    if (!existing) {
      return c.json({ error: "Order not found" }, 404);
    }

    const order = await orderService.updateOrderStatus(id, data);
    return c.json(order);
  }
);

orders.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const existing = await orderService.getOrderById(id);
  if (!existing) {
    return c.json({ error: "Order not found" }, 404);
  }

  await orderService.deleteOrder(id);
  return c.json({ success: true });
});

export default orders;
