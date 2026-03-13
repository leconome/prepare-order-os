import { Hono } from "hono";
import { auth } from "../lib/auth.js";

const authRoutes = new Hono();

authRoutes.on(["GET", "POST"], "/*", async (c) => {
  const url = new URL(c.req.url);
  console.log(`[better-auth] ${c.req.method} ${url.pathname}`);
  console.log("[better-auth] Origin:", c.req.header("origin") || "none");
  const cookieVal = c.req.header("cookie");
  console.log("[better-auth] Cookie:", cookieVal ? `${cookieVal.slice(0, 120)}...` : "NONE");

  const response = await auth.handler(c.req.raw);

  // Log Set-Cookie headers from Better Auth responses
  const setCookies = response.headers.getSetCookie?.() || [];
  if (setCookies.length > 0) {
    for (const sc of setCookies) {
      // Show cookie name + attributes, mask the value
      const eqIdx = sc.indexOf("=");
      const semiIdx = sc.indexOf(";");
      const name = sc.slice(0, eqIdx);
      const attrs = semiIdx > -1 ? sc.slice(semiIdx) : "";
      console.log(`[better-auth] Set-Cookie: ${name}=<value>${attrs}`);
    }
  }

  return response;
});

export default authRoutes;
