import { defineConfig, loadEnv } from "@medusajs/framework/utils";

// Vite plugin to set French locale before React loads
const setFrenchLocalePlugin = () => ({
	name: "set-french-locale",
	transformIndexHtml(html) {
		// Inject script that sets i18next language in localStorage before React hydrates
		// Medusa uses 'lng' as the localStorage key (per detection config)
		const script = `<script>localStorage.setItem('lng', 'fr');</script>`;
		return html.replace("<head>", `<head>${script}`);
	},
});

// Preserve Docker/compose env so loadEnv(.env) does not override them
const dockerDatabaseUrl = process.env.DATABASE_URL;
const dockerRedisUrl = process.env.REDIS_URL ?? process.env.CACHE_REDIS_URL;

loadEnv(process.env.NODE_ENV || "development", process.cwd());

if (dockerDatabaseUrl) process.env.DATABASE_URL = dockerDatabaseUrl;
if (dockerRedisUrl) process.env.REDIS_URL = dockerRedisUrl;

module.exports = defineConfig({
	projectConfig: {
		databaseUrl: process.env.DATABASE_URL,
		http: {
			storeCors: process.env.STORE_CORS!,
			adminCors: process.env.ADMIN_CORS!,
			authCors: process.env.AUTH_CORS!,
			jwtSecret: process.env.JWT_SECRET || "supersecret",
			cookieSecret: process.env.COOKIE_SECRET || "supersecret",
		},
	},
	admin: {
		// Use MEDUSA_BACKEND_URL if explicitly set, otherwise use browser origin (same domain)
		// Browser origin works for both local dev (localhost:9000) and production
		...(process.env.MEDUSA_BACKEND_URL && {
			backendUrl: process.env.MEDUSA_BACKEND_URL,
		}),
		path: "/app",
		vite: () => ({
			plugins: [setFrenchLocalePlugin()],
		}),
	},
	modules: [
		{
			resolve: "@medusajs/medusa/caching",
			options: {
				providers: [
					{
						resolve: "@medusajs/caching-redis",
						id: "caching-redis",
						is_default: true,
						options: {
							redisUrl: process.env.REDIS_URL ?? process.env.CACHE_REDIS_URL,
						},
					},
				],
			},
		},
		{
			resolve: "./src/modules/pos",
		},
	],
});
