import { Hono } from "hono";
import { auth } from "../lib/auth.js";

const authRoutes = new Hono();

authRoutes.on(["GET", "POST"], "/*", (c) => {
  return auth.handler(c.req.raw);
});

export default authRoutes;
