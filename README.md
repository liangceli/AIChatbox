# White-Label AI Support Platform

Production-minded starter monorepo for a reusable, white-label, multi-tenant AI customer support platform.

The first tenant can be Kasta, but the platform core is intentionally tenant-agnostic. Branding, prompts, retrieval behavior, handoff policy, and integrations are expected to be configured per tenant rather than embedded in shared platform code.

## Stack

- `pnpm` workspaces
- `turbo` monorepo orchestration
- TypeScript across apps and packages
- `Next.js` admin app
- `React` embeddable customer widget
- `NestJS` API
- `Prisma` + PostgreSQL
- Redis-ready worker boundary

## Repository Layout

- `apps/admin-web` - internal admin dashboard shell
- `apps/customer-widget` - embeddable chat widget package
- `apps/api` - NestJS HTTP API
- `apps/ai-worker` - async worker entrypoint for future ingestion, retrieval, and handoff jobs
- `packages/ai-core` - shared AI and retrieval contracts
- `packages/database` - Prisma schema and database client
- `packages/types` - shared domain types
- `packages/utils` - small shared utilities
- `packages/config` - runtime environment helpers
- `packages/tenant-core` - tenant boundary contracts and helpers
- `packages/logging` - shared logging primitives
- `docs` - architecture and tenancy notes
- `infra` - local infrastructure bootstrap

## Quick Start

1. Install dependencies:

```bash
corepack pnpm install
```

2. Create a local `.env` file from `.env.example`.

3. Start local Postgres and Redis.

Use Docker if you have it:

```bash
docker compose -f infra/docker-compose.yml up -d
```

If you already run PostgreSQL or Redis locally, point `.env` at those services instead.

4. Generate Prisma client:

```bash
corepack pnpm db:generate
```

5. Apply the initial migration:

```bash
corepack pnpm db:migrate:dev -- --name init_minimal_chat_workflow
```

6. Seed local data:

```bash
corepack pnpm db:seed
```

7. Start the workspace:

```bash
corepack pnpm dev
```

## Local Services

The default local environment expects:

- PostgreSQL at `localhost:5432`
- Redis at `localhost:6379`
- API at `http://localhost:4000/v1`
- Admin web at `http://localhost:3000`

If those ports are already taken on your machine, adjust `.env` before running Prisma or the apps.

## Seeded Demo Data

The seed creates tenant-scoped demo data only:

- tenant slug: `kasta`
- support admin email: `support@kasta.example`
- one `AgentConfig`
- one tenant membership row in `Role`
- one default knowledge base

This keeps Kasta-specific data isolated to development seed data, not platform core.

## Minimal Chat Flow

1. Start the workspace with `corepack pnpm dev`
2. Open `http://localhost:3000`
3. Use the "Live local test" panel to send a message against the API
4. Verify the API health endpoint at `http://localhost:4000/v1/health`

You can also test the backend directly:

```bash
curl -X POST http://localhost:4000/v1/chat/messages \
  -H "Content-Type: application/json" \
  -H "x-tenant-slug: kasta" \
  -d "{\"message\":\"Hello\",\"visitorId\":\"local-test-visitor\"}"
```

Then fetch the conversation:

```bash
curl http://localhost:4000/v1/conversations/<conversation-id> \
  -H "x-tenant-slug: kasta"
```

And list its messages:

```bash
curl http://localhost:4000/v1/conversations/<conversation-id>/messages \
  -H "x-tenant-slug: kasta"
```

## Multi-Tenant Intent

- Every core business record is tenant-aware.
- Shared platform capabilities live in packages and generic apps.
- Tenant-specific behavior belongs in configuration, tenant-scoped database records, or future integration modules.
- The platform can evolve toward RAG, workflow orchestration, human handoff routing, and agent supervision without rewriting the core repository shape.

More detail is in [docs/architecture.md](/c:/Users/liangceli/HanecoAIPilot/docs/architecture.md) and [docs/tenancy.md](/c:/Users/liangceli/HanecoAIPilot/docs/tenancy.md).
