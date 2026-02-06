# Docker Deployment Plan — PrepareOS

## Architecture Decision

**Two containers** (store + client) + PostgreSQL, orchestrated with `docker-compose`.

| Container | App | Framework | Port |
|-----------|-----|-----------|------|
| `store` | Hono API | Node.js | 9000 |
| `client` | Next.js frontend | Node.js (standalone) | 3000 |
| `db` | PostgreSQL 15 | — | 5432 |

One container per app. Independent scaling, independent restarts, clean logs.

---

## How `turbo prune --docker` solves monorepo packaging

The core pain point — workspace dependencies, lockfile resolution, `@prepareos/data` — is handled by `turbo prune`.

```
turbo prune store --docker
```

This generates a **minimal monorepo subset** with only the packages `store` needs:

```
out/
├── json/          # package.json files + pruned lockfile (for Docker layer caching)
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── pnpm-workspace.yaml
│   ├── apps/store/package.json
│   └── packages/data/package.json
└── full/          # actual source code
    ├── apps/store/
    └── packages/data/
```

The split into `json/` vs `full/` is critical: Docker can cache the `pnpm install` layer and only rerun it when dependencies change, not on every code change.

---

## Files to create

### 1. Root `.dockerignore`

Since the build context is the monorepo root, we need a root-level `.dockerignore`. The per-app ones won't apply.

```dockerignore
node_modules
.git
.next
dist
build
.turbo
.pnpm-store
*.log
.env*
!.env.example
.DS_Store
coverage
.vscode
.idea
```

### 2. `apps/store/Dockerfile`

```dockerfile
# ── Stage 1: Prune monorepo ──
FROM node:22-alpine AS pruner
RUN corepack enable && corepack prepare pnpm@10.6.3 --activate
RUN pnpm add -g turbo
WORKDIR /app
COPY . .
RUN turbo prune store --docker

# ── Stage 2: Install dependencies ──
FROM node:22-alpine AS installer
RUN corepack enable && corepack prepare pnpm@10.6.3 --activate
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

# ── Stage 3: Build ──
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo run build --filter=store

# ── Stage 4: Production ──
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy built output + node_modules (store needs runtime deps)
COPY --from=installer /app/ .

EXPOSE 9000
CMD ["node", "apps/store/dist/index.js"]
```

**Notes:**
- Store is a plain Hono app — `tsc` compiles to `dist/`, then `node` runs it
- Runtime deps (`drizzle-orm`, `postgres`, `hono`, etc.) come from `node_modules`
- No standalone mode needed for Hono — it's just Node

### 3. `apps/client/Dockerfile`

```dockerfile
# ── Stage 1: Prune monorepo ──
FROM node:22-alpine AS pruner
RUN corepack enable && corepack prepare pnpm@10.6.3 --activate
RUN pnpm add -g turbo
WORKDIR /app
COPY . .
RUN turbo prune client --docker

# ── Stage 2: Install dependencies ──
FROM node:22-alpine AS installer
RUN corepack enable && corepack prepare pnpm@10.6.3 --activate
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

# ── Stage 3: Build ──
COPY --from=pruner /app/out/full/ .
# NEXT_PUBLIC_ vars must be present at build time
ARG NEXT_PUBLIC_STORE_API_URL
ENV NEXT_PUBLIC_STORE_API_URL=$NEXT_PUBLIC_STORE_API_URL
RUN pnpm turbo run build --filter=client

# ── Stage 4: Production (standalone) ──
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Next.js standalone output — minimal filesystem
COPY --from=installer /app/apps/client/public ./public
COPY --from=installer /app/apps/client/.next/standalone ./
COPY --from=installer /app/apps/client/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```

**Notes:**
- `next.config.ts` already has `output: "standalone"` for production
- Standalone output is self-contained (~15MB vs full `node_modules`)
- `NEXT_PUBLIC_STORE_API_URL` is passed as build arg because Next.js inlines it at build time
- The standalone server.js lives at root of the standalone directory

### 4. Updated `docker-compose.yml`

```yaml
services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: store
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 5

  store:
    build:
      context: .
      dockerfile: apps/store/Dockerfile
    ports:
      - "9000:9000"
    env_file: ./apps/store/.env.production
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  client:
    build:
      context: .
      dockerfile: apps/client/Dockerfile
      args:
        NEXT_PUBLIC_STORE_API_URL: http://store:9000
    ports:
      - "3000:3000"
    depends_on:
      - store
    restart: unless-stopped

volumes:
  postgres_data:
```

**Key details:**
- `context: .` — build from monorepo root so `turbo prune` sees everything
- `env_file` for store runtime vars (DATABASE_URL, secrets, etc.)
- `NEXT_PUBLIC_STORE_API_URL` as build arg (inlined by Next.js at build time)
- `healthcheck` on postgres so store waits for DB to be ready
- `restart: unless-stopped` for production resilience

### 5. `apps/store/.env.production` (template — don't commit real values)

```env
DATABASE_URL=postgres://postgres:postgres@db:5432/store
BETTER_AUTH_SECRET=CHANGE_ME_IN_PRODUCTION
BETTER_AUTH_URL=http://store:9000
CORS_ORIGINS=http://localhost:3000
PORT=9000
```

Note: `db` hostname (not `localhost`) because containers communicate over Docker network.

---

## turbo.json — minor improvements flagged by review

Current config works but has two things worth noting:

### 1. Use `turbo run` in root scripts (Turborepo best practice)

Current `package.json`:
```json
"dev": "turbo dev",
"build": "turbo build"
```

Should be:
```json
"dev": "turbo run dev",
"build": "turbo run build"
```

`turbo <task>` shorthand is for interactive terminal use. Scripts should use `turbo run`.

### 2. Add `lint` task to turbo.json

Currently `lint` runs via `biome check .` at root, bypassing Turbo. For consistency and caching, consider adding it as a turbo task — but this is optional since Biome is already fast.

---

## Deployment workflow

```bash
# Build and start everything
docker compose up --build -d

# Run migrations (first deploy or schema changes)
docker compose exec store node -e "import('dotenv/config')" \
  && docker compose exec store npx drizzle-kit migrate

# View logs
docker compose logs -f store client

# Rebuild just one service
docker compose up --build -d store
```

---

## Deployment strategy — from local dev to 10 clients

### The big picture

```
┌─────────┐     push      ┌───────────────┐    push images    ┌──────────────┐
│  Local   │ ──────────▶  │ GitHub Actions │ ──────────────▶  │   ghcr.io    │
│   Dev    │   to main    │  (build + tag) │                  │  (registry)  │
└─────────┘               └───────────────┘                   └──────┬───────┘
                                                                     │
                                    ┌────────────────────────────────┘
                                    │  docker compose pull
                                    ▼
                          ┌──────────────────┐
                          │   VPS (1 or 2)   │
                          │                  │
                          │  ┌─client-a────┐ │
                          │  │ store:9001  │ │
                          │  │ client:3001 │ │
                          │  │ db (vol-a)  │ │
                          │  └────────────┘ │
                          │  ┌─client-b────┐ │
                          │  │ store:9002  │ │
                          │  │ client:3002 │ │
                          │  │ db (vol-b)  │ │
                          │  └────────────┘ │
                          │  ...            │
                          │  ┌─ caddy ─────┐ │
                          │  │ reverse     │ │
                          │  │ proxy + TLS │ │
                          │  └────────────┘ │
                          └──────────────────┘
```

**Key idea**: Build images once in CI, push to a registry, pull on VPS(es). Each client is an isolated compose stack with its own DB, env vars, and ports. A single Caddy reverse proxy routes domains to the right stack.

---

### Phase 1 — Local development (what you have today)

No changes needed. Keep the current workflow:

```bash
docker compose up db          # postgres only
pnpm dev                      # turbo runs store + client + builds @prepareos/data
```

The `docker-compose.yml` in the repo stays dev-focused. Production compose files live on the server.

---

### Phase 2 — CI: GitHub Actions builds and pushes images

#### `.github/workflows/deploy.yml`

```yaml
name: Build & Deploy

on:
  push:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_PREFIX: ghcr.io/${{ github.repository_owner }}/prepareos

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Set image tag
        run: echo "TAG=$(echo $GITHUB_SHA | head -c 7)" >> $GITHUB_ENV

      - name: Build & push store image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/store/Dockerfile
          push: true
          tags: |
            ${{ env.IMAGE_PREFIX }}-store:${{ env.TAG }}
            ${{ env.IMAGE_PREFIX }}-store:latest

      - name: Build & push client image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/client/Dockerfile
          push: true
          build-args: |
            NEXT_PUBLIC_STORE_API_URL=/api
          tags: |
            ${{ env.IMAGE_PREFIX }}-client:${{ env.TAG }}
            ${{ env.IMAGE_PREFIX }}-client:latest

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to VPS via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/prepareos
            ./deploy.sh
```

**Why GitHub Container Registry (ghcr.io)?**
- Free for public repos, included in GitHub plans for private
- No extra service to manage — auth is your GitHub token
- Images live next to your code

**Why `NEXT_PUBLIC_STORE_API_URL=/api`?**
At build time, the client only needs to know the relative path. Caddy will proxy `/api` to the store container. This means the **same client image works for every client** — no per-client rebuild.

---

### Phase 3 — VPS: per-client compose stacks

#### Directory structure on the VPS

```
/opt/prepareos/
├── deploy.sh                    # pulls latest images, restarts all clients
├── docker-compose.caddy.yml     # shared reverse proxy
├── Caddyfile                    # routing rules for all clients
├── clients/
│   ├── client-a/
│   │   ├── docker-compose.yml   # stack for client A
│   │   └── .env                 # client A secrets
│   ├── client-b/
│   │   ├── docker-compose.yml
│   │   └── .env
│   └── ...
```

#### Per-client `docker-compose.yml` (e.g. `clients/client-a/docker-compose.yml`)

```yaml
services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: store
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 5
    networks:
      - internal

  store:
    image: ghcr.io/YOUR_USER/prepareos-store:latest
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - internal
      - proxy

  client:
    image: ghcr.io/YOUR_USER/prepareos-client:latest
    depends_on:
      - store
    restart: unless-stopped
    networks:
      - proxy

volumes:
  db_data:

networks:
  internal:
  proxy:
    external: true
    name: caddy_network
```

**No published ports** — Caddy handles external routing. Containers only expose to the shared `caddy_network`.

#### Per-client `.env` (e.g. `clients/client-a/.env`)

```env
DATABASE_URL=postgres://postgres:STRONG_PASSWORD_HERE@db:5432/store
BETTER_AUTH_SECRET=UNIQUE_SECRET_PER_CLIENT
BETTER_AUTH_URL=https://client-a.prepareos.com
CORS_ORIGINS=https://client-a.prepareos.com
PORT=9000
DB_PASSWORD=STRONG_PASSWORD_HERE
```

#### Shared Caddy reverse proxy (`docker-compose.caddy.yml`)

```yaml
services:
  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    restart: unless-stopped
    networks:
      - caddy_network

volumes:
  caddy_data:
  caddy_config:

networks:
  caddy_network:
    external: true
    name: caddy_network
```

#### `Caddyfile` — routing per client

```caddyfile
client-a.prepareos.com {
    handle /api/* {
        reverse_proxy client-a-store-1:9000
    }
    handle {
        reverse_proxy client-a-client-1:3000
    }
}

client-b.prepareos.com {
    handle /api/* {
        reverse_proxy client-b-store-1:9000
    }
    handle {
        reverse_proxy client-b-client-1:3000
    }
}

# ... repeat per client
```

Caddy handles **automatic HTTPS** (Let's Encrypt) — zero TLS config on your end. Just point the DNS A record to the VPS IP.

#### `deploy.sh` — one-command rollout

```bash
#!/bin/bash
set -e

echo "Pulling latest images..."
docker pull ghcr.io/YOUR_USER/prepareos-store:latest
docker pull ghcr.io/YOUR_USER/prepareos-client:latest

echo "Restarting client stacks..."
for dir in /opt/prepareos/clients/*/; do
    client=$(basename "$dir")
    echo "  → $client"
    docker compose -f "$dir/docker-compose.yml" -p "$client" up -d
done

echo "Restarting Caddy..."
docker compose -f /opt/prepareos/docker-compose.caddy.yml -p caddy up -d

echo "Done. Cleaning old images..."
docker image prune -f
```

---

### Adding a new client

It's a 4-step process:

1. **DNS**: Point `client-x.prepareos.com` → VPS IP
2. **Create stack**: Copy a client folder, change the `.env`
   ```bash
   cp -r /opt/prepareos/clients/client-a /opt/prepareos/clients/client-x
   # edit /opt/prepareos/clients/client-x/.env with new secrets
   ```
3. **Add to Caddyfile**: Add the routing block for the new domain
4. **Deploy**:
   ```bash
   cd /opt/prepareos
   docker compose -f clients/client-x/docker-compose.yml -p client-x up -d
   docker compose -f docker-compose.caddy.yml -p caddy restart
   ```

Run migrations for the new client:
```bash
docker compose -p client-x exec store npx drizzle-kit migrate
docker compose -p client-x exec store npx tsx src/scripts/seed.ts
```

---

### When to use 1 VPS vs 2+

| Clients | RAM estimate | Recommendation |
|---------|-------------|----------------|
| 1–5 | ~2–4 GB | 1 VPS (4 GB) |
| 5–10 | ~4–8 GB | 1 VPS (8 GB) or split across 2 |
| 10+ | 8+ GB | Split across VPS, consider moving DB to managed postgres |

Each client stack (store + client + postgres) uses roughly 300–500 MB of RAM. The bulk is postgres and Node.js.

---

### Backups

Each client has its own postgres container. A nightly cron dumps every client's DB and pushes to object storage.

#### `backup.sh`

```bash
#!/bin/bash
set -e

BACKUP_DIR="/opt/prepareos/backups"
DATE=$(date +%Y-%m-%d_%H%M)
mkdir -p "$BACKUP_DIR"

for dir in /opt/prepareos/clients/*/; do
    client=$(basename "$dir")

    # Source the client .env to get DB_PASSWORD
    source "$dir/.env"

    echo "Backing up $client..."
    docker compose -p "$client" exec -T db \
        pg_dump -U postgres store \
        | gzip > "$BACKUP_DIR/${client}_${DATE}.sql.gz"
done

# Keep only last 7 days locally
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete

# Optional: push to S3-compatible storage (Hetzner Storage Box, OVH Object Storage, etc.)
# aws s3 sync "$BACKUP_DIR" s3://prepareos-backups/ --endpoint-url https://s3.YOUR_PROVIDER.com

echo "Backups done."
```

#### Cron setup

```bash
# Run nightly at 3am
crontab -e
0 3 * * * /opt/prepareos/backup.sh >> /var/log/prepareos-backup.log 2>&1
```

#### Restore a client's DB

```bash
gunzip -c backups/client-a_2026-02-05_0300.sql.gz \
    | docker compose -p client-a exec -T db psql -U postgres store
```

---

### Monitoring

Prometheus + Grafana is a full observability stack to deploy and maintain — disproportionate for 10 clients. Two lighter options depending on what you need:

#### Option A: Uptime Kuma (recommended to start)

Self-hosted uptime monitor. Single container, nice UI, alerts via Telegram/email/Slack/Discord.

Add to `docker-compose.caddy.yml`:

```yaml
services:
  caddy:
    # ... existing config

  uptime-kuma:
    image: louislam/uptime-kuma:1
    volumes:
      - uptime_data:/app/data
    restart: unless-stopped
    networks:
      - caddy_network

volumes:
  caddy_data:
  caddy_config:
  uptime_data:
```

Add to `Caddyfile`:

```caddyfile
status.prepareos.com {
    reverse_proxy uptime-kuma:3001
}
```

Then add one HTTP monitor per client pointing to `https://client-x.prepareos.com/api/health`. Uptime Kuma will ping every 60s and alert you if anything goes down.

**What it gives you**: uptime tracking, response time graphs, incident history, alerts. Covers 90% of monitoring needs at this scale.

#### Option B: Prometheus + Grafana (when you outgrow Uptime Kuma)

Only worth it when you need:
- Per-container CPU/memory metrics over time
- Custom dashboards per client
- Alerting on resource thresholds (e.g. "DB disk > 80%")

That's typically 20+ clients or when you start hitting resource limits and need to understand why. At that point, add:
- `node-exporter` on the VPS (system metrics)
- `cadvisor` (container metrics)
- `prometheus` (scraping + storage)
- `grafana` (dashboards)

That's 4 extra containers and config to maintain. Not needed yet.

---

### Managing the VPS without SSH — Portainer

Instead of SSH + terminal for day-to-day operations, use **Portainer** — a web UI for Docker that gives you the Docker Desktop experience on your VPS.

**What you can do from the browser:**
- View all containers across all client stacks
- Read logs in real time (with search/filter)
- Restart/stop/start individual containers
- See CPU, memory, network usage per container
- Open a terminal into a container (when you really need it)
- Manage volumes, networks, images
- Pull new images and recreate containers

Portainer Community Edition (CE) is fully free and open-source with no node limit.

#### Setup (one-time, on the VPS)

Add to `docker-compose.caddy.yml`:

```yaml
services:
  caddy:
    # ... existing config

  uptime-kuma:
    # ... existing config

  portainer:
    image: portainer/portainer-ce:lts
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - portainer_data:/data
    restart: unless-stopped
    networks:
      - caddy_network

volumes:
  caddy_data:
  caddy_config:
  uptime_data:
  portainer_data:
```

Add to `Caddyfile`:

```caddyfile
admin.prepareos.com {
    reverse_proxy portainer:9000
}
```

That's it. Navigate to `https://admin.prepareos.com`, create your admin account on first visit, and you have full visual control over every container on the VPS.

#### Day-to-day workflow with Portainer

| Task | Before (SSH) | After (Portainer) |
|------|-------------|-------------------|
| View logs | `docker compose -p client-a logs -f store` | Click container → Logs tab |
| Restart a service | `docker compose -p client-a restart store` | Click container → Restart button |
| Check resource usage | `docker stats` | Dashboard with graphs |
| Run migrations | `docker compose -p client-a exec store npx drizzle-kit migrate` | Click container → Console → paste command |
| Pull new images | `docker pull ghcr.io/...` | Images → Pull → paste tag |
| Check DB | `docker compose -p client-a exec db psql ...` | Click db container → Console |

**Deployments still happen automatically** via GitHub Actions → `deploy.sh`. Portainer is for observation and manual intervention — the things you'd normally SSH in for.

#### Alternative: Coolify (if you want to replace the entire pipeline)

If you want to go further and avoid even the GitHub Actions + deploy.sh setup, **Coolify** is a self-hosted PaaS (like Vercel/Heroku on your own VPS). It handles:
- Git push → build → deploy (replaces GitHub Actions)
- SSL certificates (replaces Caddy)
- Per-app environment variables
- Log viewing, monitoring, one-click rollbacks
- Database provisioning

The tradeoff: it's more opinionated and replaces most of the custom pipeline in this plan. Worth evaluating if terminal-free operation is a priority, but it means rewriting the deployment approach. Portainer layers on top of what we already have without changing anything.

---

### Production checklist

#### Security
- [ ] Unique `BETTER_AUTH_SECRET` per client (generate with `openssl rand -hex 32`)
- [ ] Unique `DB_PASSWORD` per client
- [ ] No `.env` files in the git repo (only `.env.example` / `.env.template`)
- [ ] VPS firewall: only ports 80, 443, and SSH open
- [ ] SSH key auth only (disable password auth)
- [ ] GitHub secrets for `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`
- [ ] ghcr.io images are private (default for private repos)

#### Backups
- [ ] `backup.sh` installed on VPS
- [ ] Cron running nightly
- [ ] Offsite copy to object storage (not just local disk)
- [ ] Test restore at least once before going live

#### Monitoring
- [ ] Uptime Kuma deployed with HTTP monitors per client
- [ ] Alert channel configured (Telegram/email/Discord)
- [ ] `/api/health` endpoint returns meaningful status (DB connectivity, not just 200)
