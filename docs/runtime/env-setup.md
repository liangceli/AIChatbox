# Runtime Env Setup

This repo is a reusable white-label platform. Runtime env examples must stay product-neutral unless a value is clearly marked local demo/seed only.

## Templates

- `.env.example`: product-neutral reference for all required runtime keys.
- `.env.local.example`: local development and local QA. The `test-*` tokens in this file are local-only placeholders.
- `.env.staging.example`: production-like staging/alpha. Do not use local QA tokens.
- `.env.production.example`: production reference. Store real secrets in the deployment secret manager.

Do not edit or commit a real `.env` with secrets.

## Tenant Slug Defaults

Use neutral defaults for new environments:

- `NEXT_PUBLIC_DEFAULT_TENANT_SLUG=demo`
- `WIDGET_DEFAULT_TENANT_SLUG=demo`

The current local seed/demo data may still use `kasta`. That value is allowed only for local seed/demo testing or company-specific deployment context, not as reusable product default.

## OpenAI Provider

Default:

- `AI_PROVIDER=deterministic`
- no external LLM call
- `OPENAI_API_KEY` is not required

Real OpenAI:

- `AI_PROVIDER=openai`
- `OPENAI_API_KEY` must be set from a secret manager or local uncommitted env
- `OPENAI_MODEL` must be set
- `OPENAI_TIMEOUT_MS` defaults to `30000`

Do not make OpenAI the default until staging smoke and manual QA pass.

## Admin Protection

Backend admin APIs are protected by default:

- `ADMIN_API_PROTECTION_MODE=token`
- `ADMIN_API_TOKEN=<server-only secret>`

Local unprotected mode is allowed only when all are true:

- `NODE_ENV` is not `production`
- `ADMIN_API_PROTECTION_MODE=disabled`
- `ALLOW_UNPROTECTED_ADMIN_API_IN_DEV=true`

Production must not use disabled admin API protection.

## Admin Web

Admin web uses a server-side proxy/access gate:

- `API_INTERNAL_BASE_URL`
- `ADMIN_API_TOKEN`
- `ADMIN_WEB_ACCESS_TOKEN`
- `ADMIN_WEB_SESSION_COOKIE_NAME`
- `ADMIN_WEB_SESSION_SECRET`
- `ADMIN_WEB_SESSION_TTL_SECONDS`

Never expose these through `NEXT_PUBLIC_*`, bundled browser code, local storage, API responses, or logs.

## Product-Neutral Runtime Values

`KNOWLEDGE_IMPORT_USER_AGENT` defaults to:

```text
PlatformKnowledgeImporter/0.1 knowledge-import
```

Do not use Haneco/Kasta/company names in reusable runtime defaults. Company names can remain in seed/demo data, docs, or isolated company deployment configuration.
