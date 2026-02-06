import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createClientSchema,
  updateClientSchema,
  clientFiltersSchema,
} from "@prepareos/data";
import * as clientService from "../services/client.service.js";
import { authMiddleware } from "../middleware/auth.js";
import type { AppEnv } from "../types.js";

const clientsRoutes = new Hono<AppEnv>();

clientsRoutes.use("*", authMiddleware);

clientsRoutes.get("/", zValidator("query", clientFiltersSchema), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const filters = c.req.valid("query");
  const result = await clientService.listClients(tenantId, filters);
  return c.json(result);
});

clientsRoutes.get("/:id", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const id = c.req.param("id");
  const client = await clientService.getClientById(tenantId, id);

  if (!client) {
    return c.json({ error: "Client not found" }, 404);
  }

  return c.json(client);
});

clientsRoutes.post(
  "/",
  zValidator("json", createClientSchema),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const data = c.req.valid("json");
    const client = await clientService.createClient(tenantId, data);
    return c.json(client, 201);
  }
);

clientsRoutes.patch(
  "/:id",
  zValidator("json", updateClientSchema),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await clientService.getClientById(tenantId, id);
    if (!existing) {
      return c.json({ error: "Client not found" }, 404);
    }

    const client = await clientService.updateClient(tenantId, id, data);
    return c.json(client);
  }
);

clientsRoutes.delete("/:id", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const id = c.req.param("id");

  const existing = await clientService.getClientById(tenantId, id);
  if (!existing) {
    return c.json({ error: "Client not found" }, 404);
  }

  await clientService.deleteClient(tenantId, id);
  return c.json({ success: true });
});

export default clientsRoutes;
