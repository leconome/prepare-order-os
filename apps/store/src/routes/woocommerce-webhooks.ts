import { Hono } from "hono";
import * as wcOrdersService from "../services/woocommerce-orders.service.js";

const router = new Hono();

router.post("/:tenantId/orders", async (c) => {
  const tenantId = c.req.param("tenantId");
  const signature = c.req.header("X-WC-Webhook-Signature") ?? "";
  const topic = c.req.header("X-WC-Webhook-Topic") ?? "";
  const rawBody = await c.req.text();

  if (!signature) {
    return c.json({ error: "Missing webhook signature" }, 401);
  }

  try {
    const result = await wcOrdersService.handleOrderWebhook(
      tenantId,
      rawBody,
      signature,
      topic,
    );
    return c.json(result, 200);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Webhook processing failed";
    if (message === "Invalid webhook signature")
      return c.json({ error: message }, 401);
    if (message === "No enabled WooCommerce connection")
      return c.json({ error: message }, 404);
    console.error("[WC Webhook Error]", e);
    return c.json({ error: message }, 500);
  }
});

export default router;
