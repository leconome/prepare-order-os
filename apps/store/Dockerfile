# Medusa Store Image for Multi-Tenant Platform
FROM node:20-alpine

# Install dependencies
RUN apk add --no-cache libc6-compat curl

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy pnpm config first (important for hoisting)
COPY .npmrc ./

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install all dependencies with shamefully-hoist
RUN pnpm install

# Copy source code
COPY . .

# Make start script executable
RUN chmod +x start.sh

# Note: We do NOT pre-build here because MEDUSA_BACKEND_URL is tenant-specific
# The build happens at runtime in start.sh with the correct environment variables

# Expose port (API and Admin served from same port)
EXPOSE 9000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD curl -f http://localhost:9000/health || exit 1

# Start with migrations and server
ENTRYPOINT ["/bin/sh", "./start.sh"]
