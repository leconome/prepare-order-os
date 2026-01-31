#!/bin/bash
# Tenant Database Backup Script
# Runs daily via cron, backs up all tenant PostgreSQL databases

set -euo pipefail

# Configuration
BACKUP_DIR="/opt/econome/backups"
RETENTION_DAYS=7
DATE=$(date +%Y-%m-%d_%H-%M-%S)
LOG_FILE="/var/log/econome/backup.log"

# Optional: S3/B2 off-site backup (configure these)
OFFSITE_ENABLED="${OFFSITE_BACKUP_ENABLED:-false}"
S3_BUCKET="${S3_BACKUP_BUCKET:-}"
S3_PREFIX="${S3_BACKUP_PREFIX:-econome-backups}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

log "Starting tenant backup run..."

# Find all tenant postgres containers
TENANT_CONTAINERS=$(docker ps --filter "label=econome.service=postgres" --format "{{.Names}}")

if [ -z "$TENANT_CONTAINERS" ]; then
  log "No tenant PostgreSQL containers found."
  exit 0
fi

BACKUP_COUNT=0
FAILED_COUNT=0

for CONTAINER in $TENANT_CONTAINERS; do
  # Extract tenant slug from container name (tenant_SLUG_postgres)
  TENANT_SLUG=$(echo "$CONTAINER" | sed 's/tenant_\(.*\)_postgres/\1/')

  BACKUP_FILE="$BACKUP_DIR/${TENANT_SLUG}_${DATE}.sql.gz"

  log "Backing up tenant: $TENANT_SLUG"

  # Get database credentials from container environment
  DB_NAME=$(docker exec "$CONTAINER" printenv POSTGRES_DB)
  DB_USER=$(docker exec "$CONTAINER" printenv POSTGRES_USER)

  # Create backup using pg_dump
  if docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl | gzip > "$BACKUP_FILE"; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log "✓ Backup created: $BACKUP_FILE ($BACKUP_SIZE)"

    # Upload to S3 if enabled
    if [ "$OFFSITE_ENABLED" = "true" ] && [ -n "$S3_BUCKET" ]; then
      if aws s3 cp "$BACKUP_FILE" "s3://$S3_BUCKET/$S3_PREFIX/$TENANT_SLUG/${TENANT_SLUG}_${DATE}.sql.gz" --quiet; then
        log "✓ Uploaded to S3: s3://$S3_BUCKET/$S3_PREFIX/$TENANT_SLUG/"
      else
        log "✗ Failed to upload to S3"
      fi
    fi

    ((BACKUP_COUNT++))
  else
    log "✗ Failed to backup tenant: $TENANT_SLUG"
    rm -f "$BACKUP_FILE"
    ((FAILED_COUNT++))
  fi
done

# Cleanup old backups (local)
log "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Summary
log "Backup run complete: $BACKUP_COUNT successful, $FAILED_COUNT failed"

# Exit with error if any backups failed
[ "$FAILED_COUNT" -eq 0 ] || exit 1
