#!/bin/sh

# Ensure node_modules exist (volume empty on first run or after reinstall prompt)
echo "Installing dependencies..."
CI=1 pnpm install --no-frozen-lockfile || true
if [ ! -f node_modules/@medusajs/cli/cli.js ]; then
  echo "Installing dependencies (clean)..."
  rm -rf node_modules
  CI=1 pnpm install
fi

# Run migrations and start server
echo "Running database migrations..."
pnpm medusa db:migrate

echo "Seeding database..."
pnpm seed || echo "Seeding failed, continuing..."

echo "Starting Medusa development server..."
pnpm dev