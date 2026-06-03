# Deployment Skill

## Current Deployment State

Production deployment is not defined yet. Current infrastructure is local-development focused.

## Local Infrastructure

Files:

- `infra/docker-compose.yml`
- `infra/README.md`

Local services:

- PostgreSQL 16 on port `5432`
- Redis 7 on port `6379`

Start local infra:

```bash
docker compose -f infra/docker-compose.yml up -d
```

## Environment Configuration

Runtime env parsing lives in `packages/config/src/index.ts`.

Current server env keys:

- `NODE_ENV`
- `DATABASE_URL`
- `REDIS_URL`
- `API_PORT`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_DEFAULT_TENANT_SLUG`
- `WIDGET_DEFAULT_TENANT_SLUG`
- `AI_PROVIDER`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_MAX_OUTPUT_TOKENS`
- `OPENAI_TIMEOUT_MS`

`AI_PROVIDER` defaults to `deterministic`. `AI_PROVIDER=openai` requires both `OPENAI_API_KEY` and `OPENAI_MODEL`; missing values fail config validation. `OPENAI_TIMEOUT_MS` defaults to `30000`.

## Build Commands

Use non-watch commands for CI/build verification:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm test`
- package-scoped variants such as `pnpm --filter @platform/api build`

Do not treat `pnpm dev` or package `dev` scripts as blocking deployment verification because they are long-running watch servers.

## Deployment Gaps

- No production Dockerfiles.
- No CI/CD pipeline documented.
- No hosting target documented.
- No production secrets strategy documented.
- No migration release process documented beyond Prisma commands.
- No Redis-backed worker/job deployment yet.
