# Store API

Backend API for PrepareOrder OS — built with [Hono](https://hono.dev), [Drizzle ORM](https://orm.drizzle.team), and PostgreSQL.

## Stack

- **Runtime**: Node.js (>=22)
- **Framework**: Hono
- **ORM**: Drizzle ORM
- **Database**: PostgreSQL
- **Auth**: better-auth (PIN-based login)
- **Validation**: Zod
- **Shared types**: `@prepareos/data` (workspace package)

## API Routes

| Route             | Description          |
| ----------------- | -------------------- |
| `/api/health`     | Health check         |
| `/api/auth`       | Authentication       |
| `/api/orders`     | Orders CRUD          |
| `/api/products`   | Products CRUD        |
| `/api/categories` | Categories CRUD      |
| `/api/menus`      | Menus CRUD           |
| `/api/users`      | Staff management     |
| `/api/clients`    | Clients CRUD         |

## Development

```bash
# From monorepo root
pnpm dev:store

# Or from this directory
pnpm dev
```

Server runs on `http://localhost:9000` by default.

## Database

```bash
# Push schema changes (dev)
pnpm db:push

# Generate migration
pnpm db:generate

# Run migrations
pnpm db:migrate

# Seed data
pnpm db:seed

# Reset & re-seed
pnpm db:drop

# Open Drizzle Studio
pnpm db:studio
```

## Environment Variables

| Variable             | Default                                            | Description          |
| -------------------- | -------------------------------------------------- | -------------------- |
| `DATABASE_URL`       | `postgres://postgres:postgres@localhost:5432/store` | PostgreSQL connection |
| `PORT`               | `9000`                                             | Server port          |
| `CORS_ORIGINS`       | `http://localhost:3000,http://localhost:3002`       | Allowed CORS origins |
| `BETTER_AUTH_SECRET`  | —                                                  | Auth secret key      |
| `BETTER_AUTH_URL`     | —                                                  | Auth base URL        |

## Build & Start

```bash
pnpm build    # Compile TypeScript
pnpm start    # Run compiled output
```
