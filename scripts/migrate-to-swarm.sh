#!/bin/bash
# Migrate from Docker Compose to Docker Swarm
# This script handles the migration of the Econome platform to Swarm mode

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "==========================================="
echo "  Econome Platform: Migrate to Docker Swarm"
echo "==========================================="
echo ""

# Check if running as root or with docker permissions
if ! docker info >/dev/null 2>&1; then
  echo "Error: Cannot connect to Docker. Make sure Docker is running and you have permissions."
  exit 1
fi

# Check if already in Swarm mode
if docker info 2>/dev/null | grep -q "Swarm: active"; then
  echo "✓ Docker Swarm is already initialized"
  SWARM_ACTIVE=true
else
  SWARM_ACTIVE=false
fi

echo ""
echo "Step 1: Pre-migration checks"
echo "----------------------------"

# Check for running containers
RUNNING_CONTAINERS=$(docker ps --format "{{.Names}}" | grep -E "^(econome|tenant_)" || true)
if [ -n "$RUNNING_CONTAINERS" ]; then
  echo "Found running containers:"
  echo "$RUNNING_CONTAINERS" | sed 's/^/  - /'
  echo ""
fi

# List current tenant data volumes
echo "Tenant data volumes (will be preserved):"
docker volume ls --format "{{.Name}}" | grep -E "^tenant_" | sed 's/^/  - /' || echo "  (none found)"
echo ""

if [ "$SWARM_ACTIVE" = false ]; then
  echo ""
  echo "Step 2: Initialize Docker Swarm"
  echo "--------------------------------"

  read -p "Initialize Docker Swarm on this node? (yes/no): " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 0
  fi

  # Get the advertise address (usually the main IP)
  ADVERTISE_ADDR=$(hostname -I | awk '{print $1}')
  echo "Using advertise address: $ADVERTISE_ADDR"

  docker swarm init --advertise-addr "$ADVERTISE_ADDR"
  echo "✓ Swarm initialized"
fi

echo ""
echo "Step 3: Create overlay network"
echo "------------------------------"

# Check if platform_network exists
if docker network ls | grep -q "platform_network"; then
  echo "Network 'platform_network' exists. Checking type..."

  NETWORK_DRIVER=$(docker network inspect platform_network --format '{{.Driver}}' 2>/dev/null || echo "unknown")

  if [ "$NETWORK_DRIVER" = "overlay" ]; then
    echo "✓ Network is already overlay type"
  else
    echo "Network is '$NETWORK_DRIVER' type, needs to be recreated as overlay"

    read -p "Remove and recreate platform_network as overlay? (yes/no): " CONFIRM
    if [ "$CONFIRM" = "yes" ]; then
      # Stop all containers using this network first
      echo "Stopping containers using platform_network..."
      docker ps --filter "network=platform_network" -q | xargs -r docker stop || true

      # Remove the network
      docker network rm platform_network || true

      # Create as overlay
      docker network create --driver overlay --attachable platform_network
      echo "✓ Created overlay network"
    else
      echo "Cannot proceed without overlay network. Aborted."
      exit 1
    fi
  fi
else
  echo "Creating overlay network 'platform_network'..."
  docker network create --driver overlay --attachable platform_network
  echo "✓ Created overlay network"
fi

echo ""
echo "Step 4: Stop existing Compose services"
echo "---------------------------------------"

if [ -f "$PROJECT_DIR/docker-compose.prod.yml" ]; then
  echo "Stopping docker-compose services..."
  cd "$PROJECT_DIR"
  docker compose -f docker-compose.prod.yml down || true
  echo "✓ Compose services stopped"
else
  echo "No docker-compose.prod.yml found, skipping"
fi

echo ""
echo "Step 5: Build platform images"
echo "-----------------------------"

cd "$PROJECT_DIR"

# Build API image
echo "Building API image..."
docker build -t econome-api:latest -f apps/api/Dockerfile.prod apps/api/

# Build Admin image
echo "Building Admin image..."
docker build -t econome-admin:latest \
  --build-arg NEXT_PUBLIC_API_URL=https://api.${DOMAIN:-localhost} \
  --build-arg NEXT_PUBLIC_DOMAIN=${DOMAIN:-localhost} \
  -f apps/admin/Dockerfile.prod apps/admin/

echo "✓ Images built"

echo ""
echo "Step 6: Deploy Swarm stack"
echo "--------------------------"

# Check for .env.production
if [ ! -f "$PROJECT_DIR/.env.production" ]; then
  echo "Warning: .env.production not found"
  echo "Create it from .env.production.example before deploying"
  exit 1
fi

# Export env vars for stack deploy
set -a
source "$PROJECT_DIR/.env.production"
set +a

# Add SWARM_MODE to environment
export SWARM_MODE=true

echo "Deploying Econome stack..."
docker stack deploy -c "$PROJECT_DIR/docker-stack.prod.yml" econome

echo "✓ Stack deployed"

echo ""
echo "Step 7: Verify deployment"
echo "-------------------------"

echo "Waiting for services to start..."
sleep 10

echo ""
echo "Service status:"
docker stack services econome

echo ""
echo "==========================================="
echo "  Migration Complete!"
echo "==========================================="
echo ""
echo "Next steps:"
echo "1. Verify services are running: docker stack services econome"
echo "2. Check service logs: docker service logs econome_api"
echo "3. Update your API to use SWARM_MODE=true"
echo "4. Recreate tenant services from containers"
echo ""
echo "To migrate existing tenants to Swarm services:"
echo "  - They will be automatically migrated on next API restart"
echo "  - Or manually trigger provisioning for each tenant"
echo ""
echo "Rollback command (if needed):"
echo "  docker stack rm econome"
echo "  docker swarm leave --force"
echo "  docker compose -f docker-compose.prod.yml up -d"
