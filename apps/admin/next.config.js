/** @type {import('next').NextConfig} */
const nextConfig = {
	// Enable standalone output for Docker production builds
	output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
};

module.exports = nextConfig;
