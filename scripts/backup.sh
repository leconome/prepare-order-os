#!/bin/bash
# ===========================================
# Database Backup Script for Econome Platform
# ===========================================
# Creates a backup of the platform database
# Usage: bash backup.sh [--upload]
#
# Options:
#   --upload   Upload backup to S3 (requires S3 configuration)
#
# Recommended: Add to crontab for daily backups
# 0 3 * * * /opt/econome/scripts/backup.sh >> /var/log/econome-backup.log 2>&1

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${RED}[ERROR]${NC} $1"
}

# ===========================================
# Configuration
# ===========================================
BACKUP_DIR="${BACKUP_DIR:-/var/backups/econome}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"

# Timestamp for backup filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="econome_platform_${TIMESTAMP}.sql.gz"

# Parse arguments
UPLOAD_TO_S3=false

for arg in "$@"; do
    case $arg in
        --upload)
            UPLOAD_TO_S3=true
            ;;
        *)
            log_warn "Unknown argument: $arg"
            ;;
    esac
done

# ===========================================
# Pre-flight Checks
# ===========================================
log_info "Starting backup process..."

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Load environment variables
if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

# ===========================================
# Create Database Backup
# ===========================================
log_info "Creating database backup: $BACKUP_FILE"

# Get the database container ID
DB_CONTAINER=$(docker compose -f "$COMPOSE_FILE" ps -q platform-db 2>/dev/null || echo "")

if [ -z "$DB_CONTAINER" ]; then
    log_error "Database container not found. Is the platform running?"
    exit 1
fi

# Create backup using pg_dump
docker exec "$DB_CONTAINER" pg_dump -U platform -d platform | gzip > "${BACKUP_DIR}/${BACKUP_FILE}"

# Verify backup was created
if [ -f "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
    BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
    log_info "Backup created successfully: ${BACKUP_FILE} (${BACKUP_SIZE})"
else
    log_error "Backup file was not created"
    exit 1
fi

# ===========================================
# Upload to S3 (Optional)
# ===========================================
if [ "$UPLOAD_TO_S3" = true ]; then
    log_info "Uploading backup to S3..."

    # Check for required S3 configuration
    if [ -z "${BACKUP_S3_BUCKET:-}" ]; then
        log_error "S3 bucket not configured. Set BACKUP_S3_BUCKET in environment."
        exit 1
    fi

    # Use AWS CLI or compatible tool
    if command -v aws &> /dev/null; then
        if [ -n "${BACKUP_S3_ENDPOINT:-}" ]; then
            # S3-compatible storage (like MinIO, DigitalOcean Spaces, etc.)
            aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 cp \
                "${BACKUP_DIR}/${BACKUP_FILE}" \
                "s3://${BACKUP_S3_BUCKET}/backups/${BACKUP_FILE}"
        else
            # AWS S3
            aws s3 cp \
                "${BACKUP_DIR}/${BACKUP_FILE}" \
                "s3://${BACKUP_S3_BUCKET}/backups/${BACKUP_FILE}"
        fi
        log_info "Backup uploaded to S3: s3://${BACKUP_S3_BUCKET}/backups/${BACKUP_FILE}"
    else
        log_warn "AWS CLI not installed. Skipping S3 upload."
    fi
fi

# ===========================================
# Cleanup Old Backups
# ===========================================
log_info "Cleaning up backups older than ${RETENTION_DAYS} days..."

# Remove old local backups
DELETED_COUNT=$(find "$BACKUP_DIR" -name "econome_platform_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete -print | wc -l)

if [ "$DELETED_COUNT" -gt 0 ]; then
    log_info "Deleted $DELETED_COUNT old backup(s)"
else
    log_info "No old backups to delete"
fi

# ===========================================
# Summary
# ===========================================
log_info "Backup process completed successfully"

# List current backups
echo ""
echo "Current backups in ${BACKUP_DIR}:"
ls -lh "$BACKUP_DIR"/econome_platform_*.sql.gz 2>/dev/null || echo "  No backups found"
echo ""

# ===========================================
# Restore Instructions
# ===========================================
cat << 'EOF'
To restore from backup:
  1. Stop the API service:
     docker compose -f docker-compose.prod.yml stop api

  2. Restore the database:
     gunzip -c /var/backups/econome/econome_platform_YYYYMMDD_HHMMSS.sql.gz | \
       docker exec -i econome-platform-db psql -U platform -d platform

  3. Start the API service:
     docker compose -f docker-compose.prod.yml start api
EOF
