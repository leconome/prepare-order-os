#!/bin/bash
# Tenant Database Restore Script
# Restores a tenant database from a backup file

set -euo pipefail

usage() {
  echo "Usage: $0 <tenant_slug> <backup_file>"
  echo ""
  echo "Example: $0 boucherie /opt/econome/backups/boucherie_2026-01-30_02-00-00.sql.gz"
  echo ""
  echo "Available backups:"
  ls -la /opt/econome/backups/*.sql.gz 2>/dev/null || echo "  No backups found"
  exit 1
}

if [ $# -lt 2 ]; then
  usage
fi

TENANT_SLUG="$1"
BACKUP_FILE="$2"
CONTAINER="tenant_${TENANT_SLUG}_postgres"

# Validate backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Validate container exists
if ! docker ps --format "{{.Names}}" | grep -q "^${CONTAINER}$"; then
  echo "Error: Container not running: $CONTAINER"
  echo "Make sure the tenant is provisioned and running."
  exit 1
fi

# Get database credentials
DB_NAME=$(docker exec "$CONTAINER" printenv POSTGRES_DB)
DB_USER=$(docker exec "$CONTAINER" printenv POSTGRES_USER)

echo "=== Tenant Database Restore ==="
echo "Tenant:    $TENANT_SLUG"
echo "Container: $CONTAINER"
echo "Database:  $DB_NAME"
echo "Backup:    $BACKUP_FILE"
echo ""

read -p "⚠️  This will OVERWRITE all current data. Continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "Stopping Medusa container..."
docker stop "tenant_${TENANT_SLUG}_medusa" 2>/dev/null || true

echo "Dropping and recreating database..."
docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"
docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

echo "Restoring from backup..."
gunzip -c "$BACKUP_FILE" | docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" --quiet

echo "Starting Medusa container..."
docker start "tenant_${TENANT_SLUG}_medusa"

echo ""
echo "✓ Restore complete!"
echo "  The tenant may take a minute to start up and run migrations."
echo "  Check logs: docker logs -f tenant_${TENANT_SLUG}_medusa"
