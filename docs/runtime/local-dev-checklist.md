# Local Dev Startup Checklist

Use this checklist for normal local QA. Do not paste real secrets into chat, docs, logs, or QA reports.

## One-Time Package Manager Setup

This repo uses the `packageManager` field in `package.json`:

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
```

On Windows without permission to write to `C:\Program Files\nodejs`, use the user npm directory instead:

```powershell
corepack enable --install-directory "$env:APPDATA\npm"
corepack prepare pnpm@9.15.0 --activate
```

After that, run commands from the repository root with `pnpm`. Do not call `.\node_modules\.bin\pnpm.CMD` for normal development.

## Required Local Env

Create an uncommitted root `.env` at the repository root. Admin local QA needs these keys:

```env
NODE_ENV=development
API_PORT=4000
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/v1
NEXT_PUBLIC_DEFAULT_TENANT_SLUG=demo
WIDGET_DEFAULT_TENANT_SLUG=demo

API_INTERNAL_BASE_URL=http://localhost:4000/v1
ADMIN_API_PROTECTION_MODE=token
ADMIN_API_TOKEN=<local admin API token>
ADMIN_WEB_ACCESS_TOKEN=<local admin web access token>
ADMIN_WEB_SESSION_SECRET=<local admin web session secret>
ADMIN_WEB_SESSION_COOKIE_NAME=platform_admin_session
ADMIN_WEB_SESSION_TTL_SECONDS=43200
```

For local placeholder QA only, `.env.local.example` uses `test-admin-token`, `test-web-token`, and `test-session-secret-for-local-qa`. If `ADMIN_WEB_ACCESS_TOKEN=test-web-token`, entering `test-web-token` at `/admin/access` should unlock the local admin UI.

OpenAI remains optional for local startup. Only set these locally or in a secret manager when running real OpenAI smoke:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=<real key set only by user locally or in secret manager>
OPENAI_MODEL=<chosen real model>
```

## Normal Startup

Start local database/Redis first:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Apply migrations and seed if needed:

```bash
pnpm --filter @platform/database exec dotenv -e ../../.env -- prisma migrate deploy
pnpm db:seed
```

Start the apps from the repository root:

```bash
pnpm dev
```

## Local URL Map

- `http://localhost:3000`: `apps/admin-web` Next app.
- `http://localhost:3000/admin/access`: local alpha admin-web access page.
- `http://localhost:3000/admin`: admin workspace after access cookie is set.
- `http://localhost:3000/agent`: agent console after access cookie is set.
- `http://localhost:3000/chat`: local customer chat/test page.
- `http://localhost:4000/v1`: `apps/api` backend.
- `http://localhost:3000/api/admin/...`: admin-web server-side proxy to protected backend API routes.

Browser code must call same-origin `http://localhost:3000/api/admin/...` for protected admin operations. The admin-web route handler injects `x-admin-api-token` server-side when the httpOnly admin-web session cookie is valid. Browser code must not send or receive `ADMIN_API_TOKEN`.

## Troubleshooting

- If PowerShell says `pnpm` is not recognized, run the one-time Corepack commands above, close and reopen the terminal, then run `pnpm dev` from the repository root.
- If `/admin/access` returns `500`, confirm the root `.env` has `API_INTERNAL_BASE_URL`, `ADMIN_API_TOKEN`, `ADMIN_WEB_ACCESS_TOKEN`, and `ADMIN_WEB_SESSION_SECRET`. Do not paste their values into chat.
- If `/admin/access` returns `403`, the entered token does not match `ADMIN_WEB_ACCESS_TOKEN`. With local placeholder config, use `test-web-token`.
- If `/api/admin/...` returns `401`, log in again at `/admin/access` so the httpOnly admin-web session cookie is set.
- If `/api/admin/...` returns `403`, confirm `ADMIN_API_TOKEN` in admin-web and API processes is the same server-only value.
- If admin API calls cannot connect, confirm `apps/api` is listening on `http://localhost:4000/v1` and `API_INTERNAL_BASE_URL=http://localhost:4000/v1`.
- If OpenAI mode fails during app startup or smoke, confirm `AI_PROVIDER=openai` is paired with both `OPENAI_API_KEY` and `OPENAI_MODEL`, set only in local `.env` or a secret manager.

## Admin Access Smoke

Run this from the repository root to verify local `/admin/access` env loading without printing token values:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/smoke-admin-web-access.ps1
```

The smoke uses port `3000` by default. To test a different admin-web port, pass `-Port`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/smoke-admin-web-access.ps1 -Port 3002
```

Expected output:

```text
admin-access-status=200
```

If the requested port is already occupied by something that is not admin-web, the smoke fails instead of following Next.js auto-selected fallback ports. Stop the process using that port, or rerun the smoke with a known free `-Port` value.
