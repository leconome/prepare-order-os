import { zValidator } from "@hono/zod-validator";
import {
  sendSmsSchema,
  smsCreditFiltersSchema,
  smsFiltersSchema,
} from "@prepareos/data";
import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { ownerOrAdmin } from "../middleware/role-guard.js";
import * as smsService from "../services/sms.service.js";
import type { AppEnv } from "../types.js";

const sms = new Hono<AppEnv>();

sms.use("*", authMiddleware);
sms.use("*", ownerOrAdmin);

// GET /sms/credits — tenant's credit balance
sms.get("/credits", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const balance = await smsService.getTenantCreditBalance(tenantId);
  return c.json({ credits: balance });
});

// GET /sms/transactions — credit ledger
sms.get(
  "/transactions",
  zValidator("query", smsCreditFiltersSchema),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const filters = c.req.valid("query");
    const result = await smsService.listCreditTransactions(tenantId, filters);
    return c.json(result);
  },
);

// GET /sms/messages — message history
sms.get("/messages", zValidator("query", smsFiltersSchema), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const filters = c.req.valid("query");
  const result = await smsService.listMessages(tenantId, filters);
  return c.json(result);
});

// POST /sms/send — send an SMS
sms.post("/send", zValidator("json", sendSmsSchema), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const user = c.get("user");
  const data = c.req.valid("json");

  try {
    const message = await smsService.sendSmsMessage(
      tenantId,
      data.recipientPhone,
      data.content,
      user.id,
      data.recipientName,
    );
    return c.json(message, 201);
  } catch (error) {
    console.error("Failed to send SMS:", error);
    const msg = error instanceof Error ? error.message : "Failed to send SMS";
    if (msg === "Insufficient SMS credits") {
      return c.json({ error: msg }, 402);
    }
    return c.json({ error: msg }, 500);
  }
});

// POST /sms/messages/:id/refresh — refresh delivery status
sms.post("/messages/:id/refresh", async (c) => {
  const messageId = c.req.param("id");
  const message = await smsService.refreshMessageStatus(messageId);
  if (!message) {
    return c.json({ error: "Message not found" }, 404);
  }
  return c.json(message);
});

export default sms;
