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
   # macOS with Homebrew
   brew install postgresql@15
   brew services start postgresql@15
   createdb store

   # Or use Docker for just Postgres
   docker run -d --name store-db \
     -e POSTGRES_DB=store \
     -e POSTGRES_USER=postgres \
     -e POSTGRES_PASSWORD=postgres \
     -p 5432:5432 \
     postgres:15-alpine
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
