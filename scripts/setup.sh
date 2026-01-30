#!/bin/bash

# Econome Platform Setup Script
# This script sets up the development environment for the multi-tenant platform

set -e

echo "==================================="
echo "  Econome Platform Setup"
echo "==================================="
echo ""

# Check for required tools
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed. Aborting." >&2; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "pnpm is required but not installed. Aborting." >&2; exit 1; }

echo "1. Installing dependencies..."
pnpm install

echo ""
echo "2. Setting up environment files..."

# API env
if [ ! -f "apps/api/.env" ]; then
  cp apps/api/.env.example apps/api/.env
  echo "   Created apps/api/.env"
else
  echo "   apps/api/.env already exists"
fi

# Admin env
if [ ! -f "apps/admin/.env.local" ]; then
  cp apps/admin/.env.example apps/admin/.env.local
  echo "   Created apps/admin/.env.local"
else
  echo "   apps/admin/.env.local already exists"
fi

echo ""
echo "3. Starting platform database..."
docker compose up -d platform-db

echo ""
echo "4. Waiting for database to be ready..."
sleep 5

# Wait for postgres to be healthy
until docker compose exec -T platform-db pg_isready -U platform -d platform > /dev/null 2>&1; do
  echo "   Waiting for PostgreSQL..."
  sleep 2
done
echo "   Database is ready!"

echo ""
echo "5. Running API database migrations..."
cd apps/api && pnpm db:push && cd ../..

echo ""
echo "6. Building Medusa tenant image..."
docker build -t econome/medusa:latest ./apps/store || echo "   Medusa image build failed (optional for development)"

echo ""
echo "==================================="
echo "  Setup Complete!"
echo "==================================="
echo ""
echo "To start the platform with Docker:"
echo "  docker compose up"
echo ""
echo "To start locally (development):"
echo "  pnpm dev"
echo ""
echo "Access points:"
echo "  - Admin Dashboard: http://admin.localhost (Docker) or http://localhost:3000 (local)"
echo "  - Provisioning API: http://api.localhost (Docker) or http://localhost:3001 (local)"
echo "  - Traefik Dashboard: http://localhost:8080"
echo "  - Database UI: http://db.localhost or http://localhost:8081"
echo ""
