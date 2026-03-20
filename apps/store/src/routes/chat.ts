// apps/store/src/routes/chat.ts

import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { Hono } from "hono";
import { getLanguageModel } from "../mcp/provider.js";
import { createProductTools } from "../mcp/tools/products.js";
import { authMiddleware } from "../middleware/auth.js";
import { ownerOrAdmin } from "../middleware/role-guard.js";
import type { AppEnv } from "../types.js";

const MAX_MESSAGES = 50;

const SYSTEM_PROMPT = `Tu es un assistant de gestion de produits pour un système de caisse (POS).
Tu aides les administrateurs à rechercher, consulter et modifier les produits.
Tu réponds TOUJOURS en français, sauf si l'utilisateur te parle dans une autre langue.

Actions disponibles :
- Rechercher des produits par nom, catégorie, niveau de stock ou statut actif/inactif
- Consulter les détails complets d'un produit, y compris ses variantes
- Créer un nouveau produit
- Modifier les champs d'un produit (nom, description, prix, stock, statut actif, catégorie, type d'unité, quantité par défaut, ordre de tri, hasVariants)

Règles :
- Confirme toujours les détails AVANT d'appeler createProduct ou updateProduct.
- Quand tu affiches des produits, formate-les clairement : nom, prix, stock, statut actif.
- Les prix sont en euros (€). Le stock peut être décimal pour les unités kg/litre.
- Sois concis. Donne des réponses courtes et directes.

Field types:
- price: decimal with up to 2 decimal places (e.g. 12.50)
- stock: decimal with up to 3 decimal places (e.g. 1.500), nullable
- defaultQty: decimal, nullable
- unitType: one of piece, kg, l, cl, g, ml, portion, pack, slice, unit, box, bottle, can, cup, bowl, plate, dozen, half, quarter
- isActive / hasVariants: boolean`;

const chatRoutes = new Hono<AppEnv>();

chatRoutes.post("/", authMiddleware, ownerOrAdmin, async (c) => {
  const body = await c.req.json();
  const messages = body.messages;
  const requestTenantId = body.tenantId;

  if (!Array.isArray(messages) || messages.length === 0) {
    return c.json({ error: "messages array is required" }, 400);
  }

  if (messages.length > MAX_MESSAGES) {
    return c.json(
      { error: `Maximum ${MAX_MESSAGES} messages per conversation` },
      400,
    );
  }

  // tenantId can come from tenant middleware (subdomain) or request body (admin pages)
  const tenantId = (c.get("tenantId") as string | undefined) ?? requestTenantId;
  if (!tenantId) {
    return c.json({ error: "tenantId is required" }, 400);
  }

  const tools = createProductTools(tenantId);

  try {
    const model = getLanguageModel();

    const modelMessages = await convertToModelMessages(messages);

    const result = streamText({
      model,
      system: SYSTEM_PROMPT,
      messages: modelMessages,
      tools,
      maxOutputTokens: 2048,
      stopWhen: stepCountIs(5),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("[chat] LLM error:", error);
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Chat service unavailable",
      },
      500,
    );
  }
});

export default chatRoutes;
