# Client

Front-end dashboard for PrepareOrder OS — built with [Next.js](https://nextjs.org), React 19, and shadcn/ui.

## Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: shadcn/ui, Tailwind CSS, Lucide icons
- **Data fetching**: TanStack Query (React Query)
- **Auth**: better-auth client
- **Shared types**: `@prepareos/data` (workspace package)

## Development

```bash
# From monorepo root
pnpm dev:client

# Or from this directory
pnpm dev
```

Runs on `http://localhost:3000` by default.

## Environment Variables

| Variable                    | Default                 | Description                                              |
| --------------------------- | ----------------------- | -------------------------------------------------------- |
| `NEXT_PUBLIC_STORE_API_URL` | `http://localhost:9000` | Store API base URL                                       |
| `NEXT_PUBLIC_STAGE`         | —                       | Set to `dev` to show dev credentials section on login    |

## Build & Start

```bash
pnpm build
pnpm start
```
