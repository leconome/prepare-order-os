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

# Expose ports (API and Admin)
EXPOSE 9000 5173

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
  CMD curl -f http://localhost:9000/health || exit 1

# Start with migrations and dev server
ENTRYPOINT ["/bin/sh", "./start.sh"]
