import type { Context, Next } from "hono";

/**
 * API key authentication middleware for CI/CD endpoints.
 * Validates Bearer token against the API_KEY environment variable.
 */
export async function apiKeyAuth(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  const apiKey = process.env.API_KEY;

  // If no API key is configured, skip auth (development mode)
  if (!apiKey) {
    return next();
  }

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized: Missing or invalid Authorization header" }, 401);
  }

  const token = authHeader.slice(7);
  if (token !== apiKey) {
    return c.json({ error: "Unauthorized: Invalid API key" }, 401);
  }

  return next();
}
