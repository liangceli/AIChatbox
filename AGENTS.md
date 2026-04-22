# Repository Rules

## Purpose

This repository is a reusable, white-label, multi-tenant AI support platform. It is not a single-client codebase. Tenant-specific behavior must remain outside platform core unless it is represented as configuration, tenant-scoped data, or an explicitly isolated integration module.

## Workspace Expectations

- Package manager: `pnpm`
- Monorepo runner: `turbo`
- Language: TypeScript everywhere
- Main apps:
  - `apps/admin-web`
  - `apps/customer-widget`
  - `apps/api`
  - `apps/ai-worker`

## Build, Lint, Test

- Install dependencies with `pnpm install`
- Start all dev processes with `pnpm dev`
- Build the workspace with `pnpm build`
- Run workspace checks with `pnpm lint` and `pnpm typecheck`
- Run placeholder test tasks with `pnpm test`

Note: this starter scaffold keeps linting lightweight. Current `lint` scripts act as workspace sanity checks and should be upgraded to a dedicated ESLint or Biome setup before production hardening.

## Architecture Rules

- Do not hardcode tenant names, prompts, branding, escalation rules, or knowledge-base logic into platform core.
- Keep every business-critical table tenant-aware unless the data is truly platform-global.
- Prefer shared contracts in `packages/*` over copy-pasted types between apps.
- Put reusable AI interfaces in `packages/ai-core`, not inside one app.
- Keep widget-facing and admin-facing concerns separate.
- Use `packages/tenant-core` for tenant runtime boundaries and helper contracts.
- Use `packages/config` for runtime env parsing instead of scattering raw `process.env` access.
- Keep future workflow orchestration optional. Do not add LangGraph or similar orchestration frameworks until there is a real execution need.

## Do-Not Rules

- Do not add Kasta-only logic to shared modules.
- Do not introduce heavy dependencies without a concrete reason.
- Do not create cross-app imports between `apps/*`.
- Do not bypass tenant scoping in Prisma queries once application logic is added.
- Do not store unstructured tenant behavior in random constants when it can live in config or tenant-scoped tables.

## Suggested Development Flow

1. Start with shared contracts and tenant boundaries.
2. Add API modules against tenant-aware schemas.
3. Add ingestion and retrieval pipelines in `apps/ai-worker`.
4. Keep UI apps thin and configuration-driven.
