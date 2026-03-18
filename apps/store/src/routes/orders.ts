import { zValidator } from "@hono/zod-validator";
import {
  createOrderSchema,
  orderFiltersSchema,
  toggleItemPreparedSchema,
  updateOrderItemsSchema,
  updateOrderSchema,
  updateOrderStatusSchema,
} from "@prepareos/data";
import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { ownerOrAdmin } from "../middleware/role-guard.js";
import * as exportService from "../services/export.service.js";
import * as orderService from "../services/order.service.js";
import type { AppEnv } from "../types.js";

const orders = new Hono<AppEnv>();

orders.use("*", authMiddleware);

orders.get("/", zValidator("query", orderFiltersSchema), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const filters = c.req.valid("query");
  const result = await orderService.listOrders(tenantId, filters);
  return c.json(result);
});

// GET /orders/export — download CSV or XLSX
orders.get("/export", ownerOrAdmin, async (c) => {
  const tenantId = c.get("tenantId") as string;
  const format = c.req.query("format") || "csv";

  if (format !== "csv" && format !== "xlsx") {
    return c.json({ error: "Format must be csv or xlsx" }, 400);
  }

  const result = await orderService.listOrders(tenantId, {
    limit: 10000,
    page: 1,
  });
  const rows = exportService.flattenOrders(result.data);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `commandes-${date}`;

  if (format === "csv") {
    const csv = exportService.generateCsv(rows);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  }

  const buffer = await exportService.generateXlsx(rows);
  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
    },
  });
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

  try {
    const order = await orderService.createOrder(tenantId, orderData);
    return c.json(order, 201);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Stock insuffisant")) {
      return c.json({ error: err.message }, 409);
    }
    throw err;
  }
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
    return c.json({ error: "Cannot modify items on a completed order" }, 409);
  }

  try {
    const order = await orderService.updateOrder(tenantId, id, data);
    return c.json(order);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Stock insuffisant")) {
      return c.json({ error: err.message }, 409);
    }
    throw err;
  }
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
  "/:id/items",
  zValidator("json", updateOrderItemsSchema),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await orderService.getOrderById(tenantId, id);
    if (!existing) {
      return c.json({ error: "Order not found" }, 404);
    }

    const order = await orderService.updateOrderItems(tenantId, id, data);
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
