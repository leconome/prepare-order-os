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

# Build Medusa for production (pre-compile at image build time)
RUN pnpm build

# Install production dependencies in the built server
WORKDIR /app/.medusa/server
RUN pnpm install --prod=false

# Back to app directory
WORKDIR /app

# Make start script executable
RUN chmod +x start.sh

# Expose port (API and Admin served from same port)
EXPOSE 9000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD curl -f http://localhost:9000/health || exit 1

# Start with migrations and server
ENTRYPOINT ["/bin/sh", "./start.sh"]
