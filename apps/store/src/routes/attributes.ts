import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createAttributeSchema,
  updateAttributeSchema,
  createTermSchema,
  updateTermSchema,
} from "@prepareos/data";
import * as attributeService from "../services/attribute.service.js";
import { authMiddleware } from "../middleware/auth.js";
import { ownerOrAdmin } from "../middleware/role-guard.js";
import type { AppEnv } from "../types.js";

const attributes = new Hono<AppEnv>();

attributes.use("*", authMiddleware);

// ── Attribute routes ──

attributes.get("/", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const data = await attributeService.listAttributes(tenantId);
  return c.json(data);
});

attributes.get("/:id", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const id = c.req.param("id");
  const attribute = await attributeService.getAttributeById(tenantId, id);

  if (!attribute) {
    return c.json({ error: "Attribute not found" }, 404);
  }

  return c.json(attribute);
});

attributes.post(
  "/",
  ownerOrAdmin,
  zValidator("json", createAttributeSchema),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const data = c.req.valid("json");
    const attribute = await attributeService.createAttribute(tenantId, data);
    return c.json(attribute, 201);
  },
);

attributes.patch(
  "/:id",
  ownerOrAdmin,
  zValidator("json", updateAttributeSchema),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await attributeService.getAttributeById(tenantId, id);
    if (!existing) {
      return c.json({ error: "Attribute not found" }, 404);
    }

    const attribute = await attributeService.updateAttribute(tenantId, id, data);
    return c.json(attribute);
  },
);

attributes.delete("/:id", ownerOrAdmin, async (c) => {
  const tenantId = c.get("tenantId") as string;
  const id = c.req.param("id");

  const existing = await attributeService.getAttributeById(tenantId, id);
  if (!existing) {
    return c.json({ error: "Attribute not found" }, 404);
  }

  await attributeService.deleteAttribute(tenantId, id);
  return c.json({ success: true });
});

// ── Term routes ──

attributes.post(
  "/:id/terms",
  ownerOrAdmin,
  zValidator("json", createTermSchema),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const attributeId = c.req.param("id");
    const data = c.req.valid("json");
    const term = await attributeService.createTerm(tenantId, attributeId, data);

    if (!term) {
      return c.json({ error: "Attribute not found" }, 404);
    }

    return c.json(term, 201);
  },
);

attributes.patch(
  "/:id/terms/:termId",
  ownerOrAdmin,
  zValidator("json", updateTermSchema),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const attributeId = c.req.param("id");
    const termId = c.req.param("termId");
    const data = c.req.valid("json");
    const term = await attributeService.updateTerm(
      tenantId,
      attributeId,
      termId,
      data,
    );

    if (!term) {
      return c.json({ error: "Term not found" }, 404);
    }

    return c.json(term);
  },
);

attributes.delete("/:id/terms/:termId", ownerOrAdmin, async (c) => {
  const tenantId = c.get("tenantId") as string;
  const attributeId = c.req.param("id");
  const termId = c.req.param("termId");
  const deleted = await attributeService.deleteTerm(
    tenantId,
    attributeId,
    termId,
  );

  if (!deleted) {
    return c.json({ error: "Term not found" }, 404);
  }

  return c.json({ success: true });
});

export default attributes;
