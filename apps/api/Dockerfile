FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files first
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install

# Copy source
COPY . .

# Expose port
EXPOSE 3001

# Create startup script with dependency check, migrations, then server start
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'set -e' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# Ensure dependencies are installed' >> /app/start.sh && \
    echo 'if [ ! -d node_modules ] || [ ! -f node_modules/tsx/dist/cli.mjs ]; then' >> /app/start.sh && \
    echo '  echo "Installing dependencies..."' >> /app/start.sh && \
    echo '  pnpm install' >> /app/start.sh && \
    echo 'fi' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo 'echo "Running database migrations..."' >> /app/start.sh && \
    echo 'pnpm db:push || echo "Migration failed, will retry on next restart"' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo 'echo "Starting API server..."' >> /app/start.sh && \
    echo 'exec pnpm dev' >> /app/start.sh && \
    chmod +x /app/start.sh

CMD ["/bin/sh", "/app/start.sh"]
