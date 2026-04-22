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
pnpm install
```

2. Start local Postgres and Redis:

```bash
docker compose -f infra/docker-compose.yml up -d
```

3. Create a local `.env` file from `.env.example`

4. Generate Prisma client:

```bash
pnpm db:generate
```

5. Start the workspace:

```bash
pnpm dev
```

## Multi-Tenant Intent

- Every core business record is tenant-aware.
- Shared platform capabilities live in packages and generic apps.
- Tenant-specific behavior belongs in configuration, tenant-scoped database records, or future integration modules.
- The platform can evolve toward RAG, workflow orchestration, human handoff routing, and agent supervision without rewriting the core repository shape.

More detail is in [docs/architecture.md](/c:/Users/liangceli/HanecoAIPilot/docs/architecture.md) and [docs/tenancy.md](/c:/Users/liangceli/HanecoAIPilot/docs/tenancy.md).
