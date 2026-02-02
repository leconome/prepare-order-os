# Development Dockerfile for Client Storefront
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install

# Copy source (will be overridden by volume in dev)
COPY . .

# Expose port
EXPOSE 3002

# Install deps if missing (handles volume mount case) and start dev server
CMD sh -c "if [ ! -d node_modules ] || [ ! -f node_modules/next/dist/bin/next ]; then pnpm install; fi && pnpm dev --port 3002"
