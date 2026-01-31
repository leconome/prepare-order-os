#!/bin/sh

# Wait for PostgreSQL to be ready
echo "Waiting for database to be ready..."
sleep 5

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

# Build Medusa with correct MEDUSA_BACKEND_URL for this tenant
# This must happen at runtime because each tenant has a different URL
echo "Building Medusa for production..."
echo "MEDUSA_BACKEND_URL=$MEDUSA_BACKEND_URL"
pnpm build

# Install production dependencies
echo "Installing production dependencies..."
cd .medusa/server
pnpm install --prod=false

# Start the production server
echo "Starting Medusa production server..."
exec pnpm start
