#!/bin/bash
# Setup automated daily backups via cron

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-tenants.sh"

# Make scripts executable
chmod +x "$BACKUP_SCRIPT"
chmod +x "$SCRIPT_DIR/restore-tenant.sh"

# Create log directory
mkdir -p /var/log/econome
mkdir -p /opt/econome/backups

# Add cron job for daily backups at 2 AM
CRON_JOB="0 2 * * * $BACKUP_SCRIPT >> /var/log/econome/backup.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "backup-tenants.sh"; then
  echo "Cron job already exists. Updating..."
  crontab -l | grep -v "backup-tenants.sh" | crontab -
fi

# Add the cron job
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "✓ Backup cron job installed"
echo "  Schedule: Daily at 2:00 AM"
echo "  Script:   $BACKUP_SCRIPT"
echo "  Log:      /var/log/econome/backup.log"
echo "  Backups:  /opt/econome/backups/"
echo ""
echo "To test immediately: $BACKUP_SCRIPT"
echo "To view cron jobs:   crontab -l"
