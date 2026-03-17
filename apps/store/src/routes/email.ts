import { zValidator } from "@hono/zod-validator";
import {
  emailFiltersSchema,
  sendBroadcastEmailSchema,
  sendEmailSchema,
} from "@prepareos/data";
import { render } from "@react-email/components";
import { Hono } from "hono";
import { OrderReadyEmail } from "../emails/order-ready.js";
import { authMiddleware } from "../middleware/auth.js";
import { ownerOrAdmin } from "../middleware/role-guard.js";
import * as emailService from "../services/email.service.js";
import type { AppEnv } from "../types.js";

const email = new Hono<AppEnv>();

email.use("*", authMiddleware);
email.use("*", ownerOrAdmin);

// GET /email/messages — email history
email.get("/messages", zValidator("query", emailFiltersSchema), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const filters = c.req.valid("query");
  const result = await emailService.listEmailMessages(tenantId, filters);
  return c.json(result);
});

// POST /email/send — send a single email
email.post("/send", zValidator("json", sendEmailSchema), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const user = c.get("user");
  const data = c.req.valid("json");

  try {
    const message = await emailService.sendEmailMessage(
      tenantId,
      data.recipientEmail,
      data.subject,
      data.html,
      data.type,
      user.id,
      data.recipientName,
    );
    return c.json(message, 201);
  } catch (error) {
    console.error("Failed to send email:", error);
    const msg = error instanceof Error ? error.message : "Failed to send email";
    return c.json({ error: msg }, 500);
  }
});

// POST /email/broadcast — send to all clients with email
email.post(
  "/broadcast",
  zValidator("json", sendBroadcastEmailSchema),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const user = c.get("user");
    const data = c.req.valid("json");

    try {
      const result = await emailService.sendBroadcastEmail(
        tenantId,
        data.subject,
        data.html,
        user.id,
      );
      return c.json(result);
    } catch (error) {
      console.error("Failed to send broadcast:", error);
      const msg =
        error instanceof Error ? error.message : "Failed to send broadcast";
      return c.json({ error: msg }, 500);
    }
  },
);

// POST /email/render/order-ready — render email template to HTML
email.post("/render/order-ready", async (c) => {
  const body = await c.req.json();
  const html = await render(
    OrderReadyEmail({
      clientName: body.clientName,
      ticketNumber: body.ticketNumber,
      shopName: body.shopName,
      pickupTime: body.pickupTime,
      items: body.items ?? [],
      total: body.total ?? "0.00 €",
    }),
  );
  return c.json({ html });
});

export default email;
