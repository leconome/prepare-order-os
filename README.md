# Prepare Order OS

A simple POS (Point of Sale) system with order management.

## Stack
- **Backend**: Hono + Drizzle + BetterAuth
- **Frontend**: Next.js 15
- **Database**: PostgreSQL

## Prerequisites
- Node.js 22+
- pnpm 10+
- PostgreSQL 15+

## Quick Start

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Setup PostgreSQL**
   ```bash
   # Using docker-compose (recommended)
   docker compose up -d

   # Or macOS with Homebrew
   brew install postgresql@15
   brew services start postgresql@15
   createdb store
   ```

3. **Configure environment**
   ```bash
   cp apps/store/.env.example apps/store/.env
   cp apps/client/.env.example apps/client/.env
   ```

4. **Push database schema**
   ```bash
   pnpm db:push
   ```

5. **Start development**
   ```bash
   pnpm dev
   ```

6. **Open apps**
   - API: http://localhost:9000
   - Client: http://localhost:3000

## Database Management

```bash
# Push schema changes
pnpm db:push

# Open Drizzle Studio (GUI)
pnpm db:studio
```
