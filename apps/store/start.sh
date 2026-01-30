#!/bin/sh

# Ensure node_modules exist
echo "Checking dependencies..."
if [ ! -d node_modules ] || [ ! -f node_modules/@medusajs/cli/cli.js ]; then
  echo "Installing dependencies..."
  rm -rf node_modules
  CI=1 pnpm install
fi

# Wait for PostgreSQL to be ready (simple sleep-based approach)
echo "Waiting for database to be ready..."
sleep 10

# Run migrations with retry
echo "Running database migrations..."
for i in 1 2 3; do
  if pnpm medusa db:migrate; then
    echo "Migrations completed successfully!"
    break
  else
    echo "Migration attempt $i failed, retrying in 5 seconds..."
    sleep 5
  fi
done

# Create admin user if credentials are provided
if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  echo "Creating admin user..."
  pnpm medusa user -e "$ADMIN_EMAIL" -p "$ADMIN_PASSWORD" 2>/dev/null || echo "Admin user may already exist"
fi

# Seed database (optional)
echo "Seeding database..."
pnpm seed 2>/dev/null || echo "Seeding skipped"

# Check if running in production mode
if [ "$NODE_ENV" = "production" ]; then
  echo "Building Medusa for production..."
  pnpm build

  echo "Starting Medusa production server..."
  exec pnpm start
else
  echo "Starting Medusa development server..."
  exec pnpm dev
fi
