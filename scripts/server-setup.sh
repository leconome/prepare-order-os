#!/bin/bash
# ===========================================
# Server Setup Script for Econome Platform
# ===========================================
# Run this script on a fresh Ubuntu 22.04 VPS to prepare for deployment
# Usage: sudo bash server-setup.sh
#
# This script:
# 1. Updates system packages
# 2. Installs Docker and Docker Compose
# 3. Configures firewall (UFW)
# 4. Creates deployment user
# 5. Sets up directory structure

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run as root (sudo)"
    exit 1
fi

# ===========================================
# System Updates
# ===========================================
log_info "Updating system packages..."
apt-get update
apt-get upgrade -y

# ===========================================
# Install Dependencies
# ===========================================
log_info "Installing required packages..."
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    ufw \
    fail2ban

# ===========================================
# Install Docker
# ===========================================
if command -v docker &> /dev/null; then
    log_info "Docker is already installed"
else
    log_info "Installing Docker..."

    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    # Add the repository to Apt sources
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    log_info "Docker installed successfully"
fi

# ===========================================
# Configure Docker
# ===========================================
log_info "Configuring Docker..."

# Enable and start Docker
systemctl enable docker
systemctl start docker

# Configure Docker daemon for production
cat > /etc/docker/daemon.json <<EOF
{
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "10m",
        "max-file": "3"
    },
    "storage-driver": "overlay2"
}
EOF

systemctl restart docker

# ===========================================
# Create Deploy User
# ===========================================
DEPLOY_USER="deploy"

if id "$DEPLOY_USER" &>/dev/null; then
    log_info "User $DEPLOY_USER already exists"
else
    log_info "Creating deployment user: $DEPLOY_USER"
    useradd -m -s /bin/bash "$DEPLOY_USER"

    # Add to docker group
    usermod -aG docker "$DEPLOY_USER"

    # Set up SSH directory
    mkdir -p /home/$DEPLOY_USER/.ssh
    chmod 700 /home/$DEPLOY_USER/.ssh
    touch /home/$DEPLOY_USER/.ssh/authorized_keys
    chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys
    chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh

    log_warn "Add your SSH public key to /home/$DEPLOY_USER/.ssh/authorized_keys"
fi

# ===========================================
# Configure Firewall (UFW)
# ===========================================
log_info "Configuring firewall..."

# Reset UFW to default
ufw --force reset

# Default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (important: do this before enabling!)
ufw allow 22/tcp comment 'SSH'

# Allow HTTP and HTTPS
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# Enable UFW
ufw --force enable

log_info "Firewall configured. Open ports: 22 (SSH), 80 (HTTP), 443 (HTTPS)"

# ===========================================
# Configure Fail2Ban
# ===========================================
log_info "Configuring Fail2Ban..."

cat > /etc/fail2ban/jail.local <<EOF
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 24h
EOF

systemctl enable fail2ban
systemctl restart fail2ban

# ===========================================
# Create Application Directory
# ===========================================
APP_DIR="/opt/econome"

log_info "Creating application directory: $APP_DIR"
mkdir -p $APP_DIR
chown $DEPLOY_USER:$DEPLOY_USER $APP_DIR

# Create backup directory
mkdir -p /var/backups/econome
chown $DEPLOY_USER:$DEPLOY_USER /var/backups/econome

# ===========================================
# Create Docker Network
# ===========================================
log_info "Creating Docker network..."
docker network create platform_network 2>/dev/null || log_info "Network 'platform_network' already exists"

# ===========================================
# Summary
# ===========================================
echo ""
echo "=========================================="
echo -e "${GREEN}Server Setup Complete!${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Add your SSH public key to /home/$DEPLOY_USER/.ssh/authorized_keys"
echo "2. Clone your repository to $APP_DIR"
echo "3. Create .env.production file from .env.production.example"
echo "4. Run: docker compose -f docker-compose.prod.yml up -d"
echo ""
echo "Important paths:"
echo "  - Application: $APP_DIR"
echo "  - Backups: /var/backups/econome"
echo ""
echo "Security notes:"
echo "  - SSH key-only authentication is recommended"
echo "  - Fail2Ban is active for SSH protection"
echo "  - Firewall allows only ports 22, 80, 443"
echo ""
