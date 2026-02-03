import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index.js";

const health = new Hono();

// GET /health - Platform health check
health.get("/", async (c) => {
	const checks: Record<string, { status: string; latency?: number }> = {};

	// Check database
	const dbStart = Date.now();
	try {
		await db.execute(sql`SELECT 1`);
		checks.database = { status: "healthy", latency: Date.now() - dbStart };
	} catch {
		checks.database = { status: "unhealthy" };
	}

	const allHealthy = Object.values(checks).every((c) => c.status === "healthy");

	return c.json(
		{
			status: allHealthy ? "healthy" : "degraded",
			timestamp: new Date().toISOString(),
			checks,
		},
		allHealthy ? 200 : 503,
	);
});

export default health;
