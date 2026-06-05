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

Environment templates and runtime checklists:

- `.env.example`: product-neutral reference.
- `.env.local.example`: local development/local QA. `test-admin-token`, `test-web-token`, and `test-session-secret-for-local-qa` are local-only placeholders.
- `.env.staging.example`: production-like staging/alpha. Do not use local QA tokens.
- `.env.production.example`: production reference. Store real secrets in the deployment secret manager.
- `docs/runtime/env-setup.md`
- `docs/runtime/openai-enable-checklist.md`
- `docs/runtime/alpha-runtime-checklist.md`
- `docs/runtime/secret-safety-checklist.md`

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
- `ADMIN_API_PROTECTION_MODE`
- `ADMIN_API_TOKEN`
- `API_INTERNAL_BASE_URL`
- `ADMIN_WEB_ACCESS_TOKEN`
- `ADMIN_WEB_SESSION_COOKIE_NAME`
- `ADMIN_WEB_SESSION_SECRET`
- `ADMIN_WEB_SESSION_TTL_SECONDS`
- `KNOWLEDGE_IMPORT_USER_AGENT`
- `ALLOW_UNPROTECTED_ADMIN_API_IN_DEV`

`AI_PROVIDER` defaults to `deterministic`. `AI_PROVIDER=openai` requires both `OPENAI_API_KEY` and `OPENAI_MODEL`; missing values fail config validation. `OPENAI_TIMEOUT_MS` defaults to `30000`.

Do not commit real API keys or secrets. Use local uncommitted `.env` files or deployment secret managers for `OPENAI_API_KEY`, `ADMIN_API_TOKEN`, `ADMIN_WEB_ACCESS_TOKEN`, and `ADMIN_WEB_SESSION_SECRET`.

New neutral env examples should use `NEXT_PUBLIC_DEFAULT_TENANT_SLUG=demo` and `WIDGET_DEFAULT_TENANT_SLUG=demo`. The seeded `kasta` slug is local demo/company-only context and should not become the reusable product default.

`ADMIN_API_PROTECTION_MODE` defaults to `token`. Protected admin/agent/platform requests need `ADMIN_API_TOKEN` through `x-admin-api-token` or `Authorization: Bearer`. `ADMIN_API_PROTECTION_MODE=disabled` is allowed only outside production and requires `ALLOW_UNPROTECTED_ADMIN_API_IN_DEV=true`.

Admin-web protected UI uses a server-side proxy. Configure `API_INTERNAL_BASE_URL`, `ADMIN_API_TOKEN`, `ADMIN_WEB_ACCESS_TOKEN`, and `ADMIN_WEB_SESSION_SECRET` as non-public server env. Do not expose these values through `NEXT_PUBLIC_*`.

`KNOWLEDGE_IMPORT_USER_AGENT` defaults to `PlatformKnowledgeImporter/0.1 knowledge-import` and can be customized without hardcoding product/company names in runtime code.

## Dependency Reproducibility

This is a pnpm monorepo and `pnpm-lock.yaml` should be tracked. The lockfile records the installed OpenAI SDK version and must not be ignored.

## Build Commands

Use non-watch commands for CI/build verification:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm test`
- package-scoped variants such as `pnpm --filter @platform/api build`

Manual OpenAI smoke test, only when a real key is available. This helper is manual-only and should not be part of normal blocking automated verification:

- `AI_PROVIDER=openai OPENAI_API_KEY=... OPENAI_MODEL=... pnpm --filter @platform/api smoke:openai`

Expected success: real assistant text, preserved backend citation, provider mode summary, fallback state, and provider metadata without secrets. Missing OpenAI env should fail clearly and should not print the API key. Real-key smoke remains pending/non-blocking until a valid key is available.

Do not treat `pnpm dev` or package `dev` scripts as blocking deployment verification because they are long-running watch servers.

## Deployment Gaps

- No production Dockerfiles.
- No CI/CD pipeline documented.
- No hosting target documented.
- No production secrets strategy documented.
- No migration release process documented beyond Prisma commands.
- No Redis-backed worker/job deployment yet.
