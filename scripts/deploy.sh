#!/bin/bash
# ===========================================
# Deployment Script for Econome Platform
# ===========================================
# Run this script to deploy or update the platform
# Usage: bash deploy.sh [--build] [--migrate]
#
# Options:
#   --build    Force rebuild of Docker images
#   --migrate  Run database migrations after deployment

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# ===========================================
# Configuration
# ===========================================
APP_DIR="${APP_DIR:-/opt/econome}"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"

# Parse arguments
BUILD_FLAG=""
RUN_MIGRATE=false

for arg in "$@"; do
    case $arg in
        --build)
            BUILD_FLAG="--build"
            ;;
        --migrate)
            RUN_MIGRATE=true
            ;;
        *)
            log_warn "Unknown argument: $arg"
            ;;
    esac
done

# ===========================================
# Pre-flight Checks
# ===========================================
log_step "Running pre-flight checks..."

# Check if we're in the right directory
if [ ! -f "$COMPOSE_FILE" ]; then
    log_error "Cannot find $COMPOSE_FILE. Make sure you're in the project root."
    exit 1
fi

# Check for environment file
if [ ! -f "$ENV_FILE" ]; then
    log_error "Environment file $ENV_FILE not found!"
    log_error "Copy .env.production.example to $ENV_FILE and configure it."
    exit 1
fi

# Load environment variables
set -a
source "$ENV_FILE"
set +a

# Verify required variables
REQUIRED_VARS=("DOMAIN" "POSTGRES_PASSWORD" "ACME_EMAIL")
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var:-}" ]; then
        log_error "Required environment variable $var is not set in $ENV_FILE"
        exit 1
    fi
done

log_info "Pre-flight checks passed"

# ===========================================
# Pull Latest Code (if in git repo)
# ===========================================
if [ -d ".git" ]; then
    log_step "Pulling latest code from git..."
    git fetch origin
    git pull origin main || log_warn "Could not pull from origin/main"
fi

# ===========================================
# Build and Deploy
# ===========================================
log_step "Deploying services..."

# Pull latest base images
log_info "Pulling latest base images..."
docker compose -f "$COMPOSE_FILE" pull --ignore-pull-failures

# Build and start services
log_info "Starting services..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d $BUILD_FLAG

# ===========================================
# Database Migrations
# ===========================================
if [ "$RUN_MIGRATE" = true ]; then
    log_step "Running database migrations..."

    # Wait for database to be healthy
    log_info "Waiting for database to be ready..."
    sleep 5

    # Run migrations
    docker compose -f "$COMPOSE_FILE" exec -T api node -e "
        const { exec } = require('child_process');
        exec('pnpm db:push', (error, stdout, stderr) => {
            if (error) {
                console.error('Migration error:', error);
                process.exit(1);
            }
            console.log(stdout);
            if (stderr) console.error(stderr);
        });
    " || log_warn "Migration command may have failed, check logs"

    log_info "Database migrations completed"
fi

# ===========================================
# Health Checks
# ===========================================
log_step "Running health checks..."

# Wait for services to start
sleep 10

# Check API health
log_info "Checking API health..."
API_HEALTH=$(curl -sf "http://localhost:3001/health" || echo "failed")
if [ "$API_HEALTH" != "failed" ]; then
    log_info "API is healthy"
else
    log_warn "API health check failed (may still be starting)"
fi

# Check container status
log_info "Container status:"
docker compose -f "$COMPOSE_FILE" ps

# ===========================================
# Cleanup
# ===========================================
log_step "Cleaning up..."

# Remove old/unused images
docker image prune -f

# Remove old/unused volumes (be careful!)
# docker volume prune -f

log_info "Cleanup completed"

# ===========================================
# Summary
# ===========================================
echo ""
echo "=========================================="
echo -e "${GREEN}Deployment Complete!${NC}"
echo "=========================================="
echo ""
echo "Services deployed:"
echo "  - API:   https://api.${DOMAIN}"
echo "  - Admin: https://admin.${DOMAIN}"
echo ""
echo "Useful commands:"
echo "  - View logs:    docker compose -f $COMPOSE_FILE logs -f"
echo "  - View status:  docker compose -f $COMPOSE_FILE ps"
echo "  - Stop all:     docker compose -f $COMPOSE_FILE down"
echo "  - Restart:      docker compose -f $COMPOSE_FILE restart"
echo ""
